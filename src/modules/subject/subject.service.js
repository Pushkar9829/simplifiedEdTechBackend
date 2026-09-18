const subjectRepo = require('./subject.repo');
const userRepo = require('../user/user.repo');
const ApiError = require('../../common/ApiError');

async function listSubjects(query) {
  const filter = {};
  if (query.includeInactive !== 'true') filter.isActive = true;
  return subjectRepo.list(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 100,
    search: query.search,
  });
}

async function createSubject(data) {
  return subjectRepo.create(data);
}

async function updateSubject(id, data) {
  const item = await subjectRepo.updateById(id, data);
  if (!item) throw new ApiError(404, 'Subject not found');
  return item;
}

async function selectSubjects(studentUserId, subjectIds) {
  const profile = await userRepo.updateStudentProfile(studentUserId, { subjectIds });
  return profile;
}

module.exports = { listSubjects, createSubject, updateSubject, selectSubjects };
