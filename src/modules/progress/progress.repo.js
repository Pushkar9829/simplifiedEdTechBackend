const { ProgressRecord, Badge, StudentBadge } = require('./progress.model');

async function createRecord(data) {
  return ProgressRecord.create(data);
}

async function upsertRecordByAssignment(assignmentId, data) {
  const key = String(assignmentId);
  const existing = await ProgressRecord.findOne({
    studentUserId: data.studentUserId,
    'meta.assignmentId': key,
  });
  if (!existing) return ProgressRecord.create({ ...data, meta: { assignmentId: key } });
  existing.set(data);
  existing.meta = { ...(existing.meta || {}), assignmentId: key };
  existing.markModified('meta');
  return existing.save();
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
        avgScore: {
          $avg: {
            $cond: [{ $in: ['$metricType', ['hours', 'badge']] }, null, '$scoreValue'],
          },
        },
        totalHours: { $sum: '$hours' },
        topics: { $addToSet: '$topic' },
      },
    },
  ]);
}

async function createBadge(data) {
  return Badge.create(data);
}

async function findBadgeById(id) {
  return Badge.findById(id);
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
  upsertRecordByAssignment,
  listRecords,
  aggregateBySubject,
  createBadge,
  findBadgeById,
  listBadges,
  awardBadge,
  studentBadges,
};
