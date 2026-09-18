const userService = require('./user.service');
const { success } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const getMe = asyncHandler(async (req, res) => {
  const data = await userService.getMe(req.user.id, req.user.role);
  return success(res, data);
});

const updateMe = asyncHandler(async (req, res) => {
  const data = await userService.updateMe(req.user.id, req.user.role, req.body);
  return success(res, data, 'Profile updated');
});

const adminList = asyncHandler(async (req, res) => {
  const data = await userService.adminListUsers(req.query);
  return success(res, data);
});

const adminSetStatus = asyncHandler(async (req, res) => {
  const data = await userService.adminSetStatus(req.params.id, req.body.status);
  return success(res, data, 'User status updated');
});

module.exports = { getMe, updateMe, adminList, adminSetStatus };
