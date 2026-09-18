const progressService = require('./progress.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const me = asyncHandler(async (req, res) => {
  const data = await progressService.myProgress(req.user.id);
  return success(res, data);
});

const forStudent = asyncHandler(async (req, res) => {
  const data = await progressService.progressForStudent(req.user, req.params.studentId);
  return success(res, data);
});

const addHours = asyncHandler(async (req, res) => {
  const data = await progressService.addHours(req.user.id, req.body);
  return created(res, data, 'Study hours recorded');
});

const listBadges = asyncHandler(async (_req, res) => {
  const data = await progressService.listBadges();
  return success(res, data);
});

const createBadge = asyncHandler(async (req, res) => {
  const data = await progressService.adminCreateBadge(req.body);
  return created(res, data, 'Badge created');
});

const awardBadge = asyncHandler(async (req, res) => {
  const data = await progressService.awardBadge(req.body.studentUserId, req.body.badgeId);
  return success(res, data, 'Badge awarded');
});

module.exports = { me, forStudent, addHours, listBadges, createBadge, awardBadge };
