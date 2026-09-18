const subjectService = require('./subject.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const data = await subjectService.listSubjects(req.query);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await subjectService.createSubject(req.body);
  return created(res, data, 'Subject created');
});

const update = asyncHandler(async (req, res) => {
  const data = await subjectService.updateSubject(req.params.id, req.body);
  return success(res, data, 'Subject updated');
});

const select = asyncHandler(async (req, res) => {
  const data = await subjectService.selectSubjects(req.user.id, req.body.subjectIds);
  return success(res, data, 'Subjects selected');
});

module.exports = { list, create, update, select };
