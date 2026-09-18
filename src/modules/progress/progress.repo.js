const { ProgressRecord, Badge, StudentBadge } = require('./progress.model');

async function createRecord(data) {
  return ProgressRecord.create(data);
}

async function listRecords(studentUserId) {
  return ProgressRecord.find({ studentUserId })
    .populate('subjectId')
    .sort({ createdAt: -1 });
}

async function aggregateBySubject(studentUserId) {
  return ProgressRecord.aggregate([
    { $match: { studentUserId: new (require('mongoose').Types.ObjectId)(studentUserId) } },
    {
      $group: {
        _id: '$subjectId',
        count: { $sum: 1 },
        avgScore: { $avg: '$scoreValue' },
        totalHours: { $sum: '$hours' },
        topics: { $addToSet: '$topic' },
      },
    },
  ]);
}

async function createBadge(data) {
  return Badge.create(data);
}

async function listBadges() {
  return Badge.find({ isActive: true });
}

async function awardBadge(studentUserId, badgeId) {
  return StudentBadge.findOneAndUpdate(
    { studentUserId, badgeId },
    { studentUserId, badgeId, awardedAt: new Date() },
    { upsert: true, new: true }
  );
}

async function studentBadges(studentUserId) {
  return StudentBadge.find({ studentUserId }).populate('badgeId');
}

module.exports = {
  createRecord,
  listRecords,
  aggregateBySubject,
  createBadge,
  listBadges,
  awardBadge,
  studentBadges,
};
