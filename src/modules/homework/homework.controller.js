const homeworkService = require('./homework.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const create = asyncHandler(async (req, res) => {
  const data = await homeworkService.create(req.user.id, req.body);
  return created(res, data, 'Assignment created');
});

const list = asyncHandler(async (req, res) => {
  const data = await homeworkService.list(req.user, req.query);
  return success(res, data);
});

const getById = asyncHandler(async (req, res) => {
  const data = await homeworkService.getById(req.user, req.params.id);
  return success(res, data);
});

const submit = asyncHandler(async (req, res) => {
  const data = await homeworkService.submit(
    req.user.id,
    req.params.id,
    req.body.notes,
    req.files
  );
  return success(res, data, 'Assignment submitted');
});

const grade = asyncHandler(async (req, res) => {
  const data = await homeworkService.grade(req.user.id, req.params.id, req.body);
  return success(res, data, 'Assignment graded');
});

module.exports = { create, list, getById, submit, grade };
