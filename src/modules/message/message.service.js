const messageRepo = require('./message.repo');
const bookingRepo = require('../booking/booking.repo');
const parentRepo = require('../parent/parent.repo');
const notificationService = require('../notification/notification.service');
const { maskText, maskFileName } = require('../../utils/contentFilter');
const { storedFileUrl } = require('../../utils/mediaUrl');
const ApiError = require('../../common/ApiError');
const { ROLES } = require('../../common/constants');

async function listConversations(userId) {
  return messageRepo.listConversations(userId);
}

async function openConversation(userId, participantId) {
  return messageRepo.findOrCreateConversation([userId, participantId]);
}

async function send(userId, body, files = []) {
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

  const filtered = maskText(body.body);
  const attachments = (files || []).map((f) => ({
    url: storedFileUrl(f),
    name: maskFileName(f.originalname || 'file'),
    mimeType: f.mimetype || '',
  }));

  const message = await messageRepo.createMessage({
    conversationId,
    senderId: userId,
    body: filtered.text,
    attachments,
    flagged: filtered.flagged,
    flaggedHits: filtered.hits,
    readBy: [userId],
  });

  const convo = await messageRepo.findConversationById(conversationId);
  const recipients = convo.participants.map(String).filter((id) => id !== userId);
  await notificationService.notifyMany(
    recipients.map((rid) => ({
      userId: rid,
      title: 'New message',
      body: filtered.text.slice(0, 120),
      type: 'message',
      meta: { conversationId },
    }))
  );

  return {
    message,
    warning: filtered.flagged
      ? 'Phone numbers, emails, and other contact details were hidden from the other person.'
      : '',
  };
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

async function contacts(user) {
  if (user.role === ROLES.TUTOR) {
    const page = await bookingRepo.list({ tutorUserId: user.id }, { page: 1, limit: 200 });
    const students = new Map();
    page.items.forEach((b) => {
      const s = b.studentUserId;
      if (s?._id) students.set(s._id.toString(), s);
    });
    const parents = await parentRepo.listParentsOfStudents([...students.keys()]);
    return {
      students: [...students.values()],
      parents: parents
        .map((l) => {
          const parent = l.parentUserId?.toObject?.() || l.parentUserId || {};
          return {
            ...parent,
            _id: parent._id,
            childName: l.studentUserId?.name || '',
            childId: l.studentUserId?._id,
          };
        })
        .filter((p) => p._id),
    };
  }
  if (user.role === ROLES.STUDENT) {
    const page = await bookingRepo.list({ studentUserId: user.id }, { page: 1, limit: 100 });
    const tutors = new Map();
    page.items.forEach((b) => {
      const t = b.tutorUserId;
      if (t?._id) tutors.set(t._id.toString(), t);
    });
    return { tutors: [...tutors.values()], students: [], parents: [] };
  }
  if (user.role === ROLES.PARENT) {
    const ids = await parentRepo.listLinkedStudentIds(user.id);
    const page = await bookingRepo.list({ studentUserId: { $in: ids } }, { page: 1, limit: 100 });
    const tutors = new Map();
    page.items.forEach((b) => {
      const t = b.tutorUserId;
      if (t?._id) tutors.set(t._id.toString(), t);
    });
    return { tutors: [...tutors.values()], students: [], parents: [] };
  }
  return { students: [], parents: [], tutors: [] };
}

module.exports = { listConversations, openConversation, send, listMessages, markRead, contacts };
