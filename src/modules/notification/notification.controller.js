const notificationService = require('./notification.service');
const { success } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const data = await notificationService.list(req.user.id, req.query);
  return success(res, data);
});

const markRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markRead(req.params.id, req.user.id);
  return success(res, data, 'Marked as read');
});

const markAllRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllRead(req.user.id);
  return success(res, data, 'All marked as read');
});

module.exports = { list, markRead, markAllRead };
