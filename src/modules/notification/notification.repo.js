const Notification = require('./notification.model');

async function create(data) {
  return Notification.create(data);
}

async function createMany(items) {
  if (!items.length) return [];
  return Notification.insertMany(items);
}

async function listByUser(userId, options = {}) {
  const { page = 1, limit = 30 } = options;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments({ userId }),
  ]);
  return { items, total, page, limit };
}

async function markRead(id, userId) {
  return Notification.findOneAndUpdate({ _id: id, userId }, { isRead: true }, { new: true });
}

async function markAllRead(userId) {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  return { updated: true };
}

module.exports = { create, createMany, listByUser, markRead, markAllRead };
