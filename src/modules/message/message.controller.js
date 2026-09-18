const messageService = require('./message.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const listConversations = asyncHandler(async (req, res) => {
  const data = await messageService.listConversations(req.user.id);
  return success(res, data);
});

const open = asyncHandler(async (req, res) => {
  const data = await messageService.openConversation(req.user.id, req.body.participantId);
  return created(res, data);
});

const send = asyncHandler(async (req, res) => {
  const data = await messageService.send(req.user.id, req.body);
  return created(res, data, 'Message sent');
});

const listMessages = asyncHandler(async (req, res) => {
  const data = await messageService.listMessages(req.user.id, req.params.id, req.query);
  return success(res, data);
});

const markRead = asyncHandler(async (req, res) => {
  const data = await messageService.markRead(req.user.id, req.params.id);
  return success(res, data, 'Marked read');
});

module.exports = { listConversations, open, send, listMessages, markRead };
