const FavoriteItem = require('./favorite.model');
const { FavoriteTutor } = require('../tutor/tutor.model');
const ApiError = require('../../common/ApiError');
const { KINDS } = require('./favorite.validator');

async function list(userId, kind) {
  const filter = { userId };
  if (kind) {
    if (!KINDS.includes(kind)) throw new ApiError(400, 'Unknown favourite kind');
    filter.kind = kind;
  }
  return FavoriteItem.find(filter).sort({ createdAt: -1 });
}

async function idsFor(userId, kind) {
  const rows = await FavoriteItem.find({ userId, kind }).select('targetId');
  return rows.map((r) => r.targetId);
}

async function add(userId, kind, targetId) {
  if (!KINDS.includes(kind)) throw new ApiError(400, 'Unknown favourite kind');
  const row = await FavoriteItem.findOneAndUpdate(
    { userId, kind, targetId },
    { userId, kind, targetId },
    { upsert: true, returnDocument: 'after' }
  );
  if (kind === 'tutor') {
    await FavoriteTutor.findOneAndUpdate(
      { studentUserId: userId, tutorUserId: targetId },
      { studentUserId: userId, tutorUserId: targetId },
      { upsert: true }
    );
  }
  return row;
}

async function remove(userId, kind, targetId) {
  const row = await FavoriteItem.findOneAndDelete({ userId, kind, targetId });
  if (kind === 'tutor') {
    await FavoriteTutor.findOneAndDelete({ studentUserId: userId, tutorUserId: targetId });
  }
  return row;
}

module.exports = { list, idsFor, add, remove };
