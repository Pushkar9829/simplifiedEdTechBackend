const notificationRepo = require('./notification.repo');
const ApiError = require('../../common/ApiError');

async function notify(userId, title, body, type = 'system', meta = {}) {
  return notificationRepo.create({ userId, title, body, type, meta });
}

async function notifyMany(entries) {
  return notificationRepo.createMany(entries);
}

async function list(userId, query) {
  return notificationRepo.listByUser(userId, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 30,
  });
}

async function markRead(id, userId) {
  const item = await notificationRepo.markRead(id, userId);
  if (!item) throw new ApiError(404, 'Notification not found');
  return item;
}

async function markAllRead(userId) {
  return notificationRepo.markAllRead(userId);
}

module.exports = { notify, notifyMany, list, markRead, markAllRead };
