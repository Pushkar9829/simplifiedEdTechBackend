const authService = require('./auth.service');
const userService = require('../user/user.service');
const { success } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const sendOtp = asyncHandler(async (req, res) => {
  const data = await authService.sendOtp(req.body);
  return success(res, data, 'OTP sent');
});

const verifyOtp = asyncHandler(async (req, res) => {
  const data = await authService.verifyOtp(req.body);
  return success(res, data, 'Authenticated');
});

const logout = asyncHandler(async (_req, res) => {
  const data = await authService.logout();
  return success(res, data);
});

const me = asyncHandler(async (req, res) => {
  const data = await userService.getMe(req.user.id, req.user.role);
  return success(res, data);
});

const google = asyncHandler(async (req, res) => {
  const data = await authService.googleLogin(req.body);
  return success(res, data, 'Authenticated');
});

module.exports = { sendOtp, verifyOtp, logout, me, google };
