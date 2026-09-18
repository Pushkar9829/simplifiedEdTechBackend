const messageRepo = require('./message.repo');
const notificationService = require('../notification/notification.service');
const ApiError = require('../../common/ApiError');

async function listConversations(userId) {
  return messageRepo.listConversations(userId);
}

async function openConversation(userId, participantId) {
  return messageRepo.findOrCreateConversation([userId, participantId]);
}

async function send(userId, body) {
  let conversationId = body.conversationId;
  if (!conversationId) {
    if (!body.participantId) throw new ApiError(400, 'participantId or conversationId required');
    const convo = await messageRepo.findOrCreateConversation([userId, body.participantId]);
    conversationId = convo._id;
  } else {
    const convo = await messageRepo.findConversationById(conversationId);
    if (!convo || !convo.participants.map(String).includes(userId)) {
      throw new ApiError(403, 'Not a participant');
    }
  }

  const message = await messageRepo.createMessage({
    conversationId,
    senderId: userId,
    body: body.body,
    readBy: [userId],
  });

  const convo = await messageRepo.findConversationById(conversationId);
  const recipients = convo.participants.map(String).filter((id) => id !== userId);
  await notificationService.notifyMany(
    recipients.map((rid) => ({
      userId: rid,
      title: 'New message',
      body: body.body.slice(0, 120),
      type: 'message',
      meta: { conversationId },
    }))
  );

  return message;
}

async function listMessages(userId, conversationId, query) {
  const convo = await messageRepo.findConversationById(conversationId);
  if (!convo || !convo.participants.map(String).includes(userId)) {
    throw new ApiError(403, 'Not a participant');
  }
  return messageRepo.listMessages(conversationId, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 50,
  });
}

async function markRead(userId, conversationId) {
  const convo = await messageRepo.findConversationById(conversationId);
  if (!convo || !convo.participants.map(String).includes(userId)) {
    throw new ApiError(403, 'Not a participant');
  }
  return messageRepo.markRead(conversationId, userId);
}

module.exports = { listConversations, openConversation, send, listMessages, markRead };
