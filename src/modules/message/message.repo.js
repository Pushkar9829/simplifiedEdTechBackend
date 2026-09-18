const { Conversation, Message } = require('./message.model');

async function findOrCreateConversation(participantIds) {
  const sorted = [...participantIds].map(String).sort();
  let convo = await Conversation.findOne({
    participants: { $all: sorted, $size: sorted.length },
  });
  if (!convo) {
    convo = await Conversation.create({ participants: sorted });
  }
  return convo;
}

async function listConversations(userId) {
  return Conversation.find({ participants: userId })
    .populate('participants', 'name phone role')
    .sort({ lastMessageAt: -1 });
}

async function createMessage(data) {
  const msg = await Message.create(data);
  await Conversation.findByIdAndUpdate(data.conversationId, { lastMessageAt: new Date() });
  return msg;
}

async function listMessages(conversationId, options = {}) {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Message.find({ conversationId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Message.countDocuments({ conversationId }),
  ]);
  return { items, total, page, limit };
}

async function markRead(conversationId, userId) {
  await Message.updateMany(
    { conversationId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );
  return { updated: true };
}

async function findConversationById(id) {
  return Conversation.findById(id);
}

module.exports = {
  findOrCreateConversation,
  listConversations,
  createMessage,
  listMessages,
  markRead,
  findConversationById,
};
