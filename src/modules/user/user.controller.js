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
  await userService.assertAdminStatusChange(req.user.id, req.params.id, req.body.status);
  const data = req.body.voidOpen
    ? await userService.adminVoidUser(req.params.id, req.body.reason, req.body.status)
    : await userService.adminSetStatus(req.params.id, req.body.status, req.body.reason);
  return success(res, data, 'User status updated');
});

const block = asyncHandler(async (req, res) => {
  const data = await userService.blockUser(req.user.id, req.body.targetUserId, req.body.reason);
  return success(res, data, 'User blocked');
});

const unblock = asyncHandler(async (req, res) => {
  const data = await userService.unblockUser(req.user.id, req.params.id);
  return success(res, data, 'User unblocked');
});

const myBlocks = asyncHandler(async (req, res) => {
  const data = await userService.listMyBlocks(req.user.id, req.user.role);
  return success(res, data);
});

module.exports = { getMe, updateMe, adminList, adminSetStatus, block, unblock, myBlocks };
