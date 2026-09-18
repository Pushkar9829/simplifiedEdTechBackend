const resourceRepo = require('./resource.repo');
const ApiError = require('../../common/ApiError');
const { storedFileUrl } = require('../../utils/mediaUrl');

async function list(query) {
  const filter = {};
  if (query.includeInactive !== 'true') filter.isActive = true;
  if (query.subjectId) filter.subjectId = query.subjectId;
  if (query.level) filter.level = query.level;
  if (query.type) filter.type = query.type;
  if (query.topic) filter.topic = new RegExp(query.topic, 'i');
  if (query.chapter) filter.chapter = new RegExp(query.chapter, 'i');
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.createdBy) filter.createdBy = query.createdBy;

  return resourceRepo.list(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
    search: query.search,
  });
}

async function getById(id) {
  const item = await resourceRepo.findById(id);
  if (!item) throw new ApiError(404, 'Resource not found');
  return item;
}

async function create(userId, body, file) {
  const fileUrl = storedFileUrl(file) || body.fileUrl || '';
  return resourceRepo.create({
    ...body,
    fileUrl,
    createdBy: userId,
  });
}

async function update(id, body) {
  const item = await resourceRepo.updateById(id, body);
  if (!item) throw new ApiError(404, 'Resource not found');
  return item;
}

async function remove(id) {
  const item = await resourceRepo.deleteById(id);
  if (!item) throw new ApiError(404, 'Resource not found');
  return item;
}

async function bookmark(userId, resourceId) {
  return resourceRepo.bookmark(userId, resourceId);
}

async function unbookmark(userId, resourceId) {
  const item = await resourceRepo.unbookmark(userId, resourceId);
  if (!item) throw new ApiError(404, 'Bookmark not found');
  return item;
}

async function myBookmarks(userId) {
  return resourceRepo.listBookmarks(userId);
}

module.exports = { list, getById, create, update, remove, bookmark, unbookmark, myBookmarks };
