const projectService = require('./project.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const data = await projectService.list(req.user, req.query);
  return success(res, data);
});

const getById = asyncHandler(async (req, res) => {
  const data = await projectService.getById(req.user, req.params.id);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await projectService.create(req.user.id, req.body, req.files || []);
  return created(res, data, 'Project created');
});

const update = asyncHandler(async (req, res) => {
  const data = await projectService.update(req.user.id, req.params.id, req.body);
  return success(res, data, 'Project updated');
});

const setStatus = asyncHandler(async (req, res) => {
  const data = await projectService.setStatus(req.user, req.params.id, req.body.status);
  return success(res, data, 'Project updated');
});

const deliver = asyncHandler(async (req, res) => {
  const data = await projectService.deliver(req.user.id, req.params.id, req.files || []);
  return success(res, data, 'Deliverables uploaded');
});

module.exports = { list, getById, create, update, setStatus, deliver };
