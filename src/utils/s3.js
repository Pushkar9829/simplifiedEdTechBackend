const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const env = require('../config/env');

function s3Enabled() {
  return Boolean(env.s3.bucket && env.s3.region);
}

let client;
function getClient() {
  if (!s3Enabled()) return null;
  if (!client) {
    const config = { region: env.s3.region };
    if (env.s3.accessKeyId && env.s3.secretAccessKey) {
      config.credentials = {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      };
    }
    client = new S3Client(config);
  }
  return client;
}

function publicUrl(key) {
  const base = (env.s3.publicBaseUrl || '').replace(/\/$/, '');
  if (base) return `${base}/${key}`;
  const bucket = env.s3.bucket;
  const region = env.s3.region;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function putObject({ key, body, contentType }) {
  const s3 = getClient();
  if (!s3) throw new Error('S3 is not configured');
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    })
  );
  return publicUrl(key);
}

module.exports = { s3Enabled, putObject, publicUrl };
