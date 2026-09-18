const { Assignment, Submission } = require('./homework.model');

async function createAssignment(data) {
  return Assignment.create(data);
}

async function findAssignmentById(id) {
  return Assignment.findById(id)
    .populate('subjectId')
    .populate('resourceIds')
    .populate('studentUserId', 'name phone')
    .populate('tutorUserId', 'name phone');
}

async function updateAssignment(id, data) {
  return Assignment.findByIdAndUpdate(id, data, { new: true });
}

async function listAssignments(filter, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Assignment.find(filter)
      .populate('subjectId')
      .sort({ deadline: 1 })
      .skip(skip)
      .limit(limit),
    Assignment.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function upsertSubmission(assignmentId, studentUserId, data) {
  const existing = await Submission.findOne({ assignmentId, studentUserId });
  if (existing) {
    existing.versionHistory.push({
      files: existing.files,
      notes: existing.notes,
      submittedAt: existing.updatedAt,
    });
    existing.files = data.files;
    existing.notes = data.notes || '';
    await existing.save();
    return existing;
  }
  return Submission.create({ assignmentId, studentUserId, ...data });
}

async function findSubmission(assignmentId, studentUserId) {
  return Submission.findOne({ assignmentId, studentUserId });
}

async function gradeSubmission(assignmentId, studentUserId, grade, feedback) {
  return Submission.findOneAndUpdate(
    { assignmentId, studentUserId },
    { grade, feedback, gradedAt: new Date() },
    { new: true }
  );
}

module.exports = {
  createAssignment,
  findAssignmentById,
  updateAssignment,
  listAssignments,
  upsertSubmission,
  findSubmission,
  gradeSubmission,
};
