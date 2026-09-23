const path = require('path');
const fs = require('fs');
const multer = require('multer');
const env = require('../config/env');
const { s3Enabled, putObject } = require('../utils/s3');
const ApiError = require('../common/ApiError');

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const raw = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const FOLDER_BY_FIELD = {
  identityDoc: 'verification',
  degreeDoc: 'verification',
  certificateDoc: 'verification',
  resumeDoc: 'verification',
  identity: 'verification',
  degree: 'verification',
  certificate: 'verification',
  resume: 'verification',
  documents: 'verification',
  files: 'homework',
  attachments: 'attachments',
  resourceFile: 'resources',
  thumbnail: 'courses',
  deliverables: 'projects',
  file: 'media',
};

function safeName(original) {
  return String(original || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function collectFiles(req) {
  const list = [];
  if (req.file) list.push(req.file);
  if (Array.isArray(req.files)) list.push(...req.files);
  else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((arr) => {
      if (Array.isArray(arr)) list.push(...arr);
    });
  }
  return list;
}

async function persistOne(file) {
  const folder = FOLDER_BY_FIELD[file.fieldname] || 'media';
  const name = `${Date.now()}-${safeName(file.originalname)}`;
  const prefix = env.s3.keyPrefix ? `${env.s3.keyPrefix.replace(/\/$/, '')}/` : '';
  const key = `${prefix}${folder}/${name}`;

  if (s3Enabled()) {
    const location = await putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });
    file.filename = key;
    file.location = location;
    file.buffer = undefined;
    return;
  }

  await fs.promises.writeFile(path.join(uploadRoot, name), file.buffer);
  file.filename = name;
  file.location = `/uploads/${name}`;
  file.buffer = undefined;
}

async function persistReqFiles(req) {
  await Promise.all(collectFiles(req).map(persistOne));
}

function wrap(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) return next(err);
      persistReqFiles(req)
        .then(() => next())
        .catch((e) => next(new ApiError(502, e.message || 'File upload failed')));
    });
  };
}

const upload = {
  single: (field) => wrap(raw.single(field)),
  array: (field, maxCount) => wrap(raw.array(field, maxCount)),
  fields: (fields) => wrap(raw.fields(fields)),
};

module.exports = { upload, uploadRoot };
