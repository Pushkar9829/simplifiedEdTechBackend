const mongoose = require('mongoose');
const homeworkRepo = require('./homework.repo');
const progressService = require('../progress/progress.service');
const notificationService = require('../notification/notification.service');
const parentRepo = require('../parent/parent.repo');
const Booking = require('../booking/booking.model');
const { notifyParentsOfStudent } = require('../../utils/parentNotify');
const ApiError = require('../../common/ApiError');
const { sanitizeAssignment } = require('../../utils/tutorPrivacy');
const { ASSIGNMENT_STATUS, ROLES } = require('../../common/constants');
const { storedFileUrl } = require('../../utils/mediaUrl');
const { normalizeGrade } = require('../../utils/grading');

function fileToAttachment(file) {
  return {
    url: storedFileUrl(file),
    name: file.originalname || '',
    mimeType: file.mimetype || '',
    size: file.size || 0,
  };
}

async function create(tutorUserId, body, files = []) {
  const data = { ...body };
  if (data.bookingId) {
    const booking = await Booking.findById(data.bookingId);
    if (!booking || booking.tutorUserId.toString() !== tutorUserId) {
      throw new ApiError(400, 'Booking not found for this tutor');
    }
    if (booking.studentUserId.toString() !== String(data.studentUserId)) {
      throw new ApiError(400, 'Booking belongs to a different student');
    }
    if (!data.subjectId) data.subjectId = booking.subjectId;
  } else {
    delete data.bookingId;
  }
  if (data.gradingScheme === 'marks' && !data.maxScore) {
    throw new ApiError(400, 'Max score is required for marks grading');
  }

  const assignment = await homeworkRepo.createAssignment({
    ...data,
    attachments: [...(data.attachments || []), ...files.map(fileToAttachment)],
    tutorUserId,
    status: ASSIGNMENT_STATUS.ASSIGNED,
  });
  await notificationService.notify(
    data.studentUserId,
    'New homework',
    `Assignment: ${data.title}`,
    'homework',
    { assignmentId: assignment._id }
  );
  await notifyParentsOfStudent(
    data.studentUserId,
    'New homework assigned',
    `Assignment: ${data.title}`,
    'homework',
    { assignmentId: assignment._id }
  );
  return assignment;
}

async function list(user, query) {
  const filter = {};
  if (user.role === 'student') filter.studentUserId = user.id;
  if (user.role === 'tutor') filter.tutorUserId = user.id;
  if (user.role === 'parent') {
    if (!query.studentUserId) {
      throw new ApiError(400, 'studentUserId query param required for parents');
    }
    const link = await parentRepo.findLink(user.id, query.studentUserId);
    if (!link) throw new ApiError(403, 'Student not linked to this parent');
    filter.studentUserId = query.studentUserId;
  }
  if (user.role === 'tutor' && query.studentUserId) filter.studentUserId = query.studentUserId;
  if (query.status) filter.status = query.status;
  if (query.bookingId) filter.bookingId = query.bookingId;
  return homeworkRepo.listAssignments(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
}

async function tutorStats(tutorUserId) {
  const counts = await homeworkRepo.countByStatus({
    tutorUserId: new mongoose.Types.ObjectId(tutorUserId),
  });
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  const overdue = await homeworkRepo.countOverdue(tutorUserId);
  return {
    toGrade: byStatus[ASSIGNMENT_STATUS.SUBMITTED] || 0,
    assigned: byStatus[ASSIGNMENT_STATUS.ASSIGNED] || 0,
    graded: byStatus[ASSIGNMENT_STATUS.GRADED] || 0,
    overdue,
  };
}

async function assertCanViewAssignment(user, assignment) {
  const studentId = (assignment.studentUserId._id || assignment.studentUserId).toString();
  const tutorId = (assignment.tutorUserId._id || assignment.tutorUserId).toString();

  if (user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.STUDENT && user.id === studentId) return;
  if (user.role === ROLES.TUTOR && user.id === tutorId) return;
  if (user.role === ROLES.PARENT) {
    const link = await parentRepo.findLink(user.id, studentId);
    if (link) return;
  }
  throw new ApiError(403, 'Not allowed to view this assignment');
}

async function getById(user, id) {
  const item = await homeworkRepo.findAssignmentById(id);
  if (!item) throw new ApiError(404, 'Assignment not found');
  await assertCanViewAssignment(user, item);
  const submission = await homeworkRepo.findSubmission(
    id,
    item.studentUserId._id || item.studentUserId
  );
  return { assignment: sanitizeAssignment(item, user.role), submission };
}

async function submit(studentUserId, assignmentId, notes, files) {
  const assignment = await homeworkRepo.findAssignmentById(assignmentId);
  if (!assignment) throw new ApiError(404, 'Assignment not found');
  if (assignment.studentUserId._id.toString() !== studentUserId) {
    throw new ApiError(403, 'Not allowed');
  }
  if (assignment.status === ASSIGNMENT_STATUS.GRADED) {
    throw new ApiError(400, 'This assignment has already been graded');
  }

  const attachments = (files || []).map(fileToAttachment).filter((f) => f.url);
  const submission = await homeworkRepo.upsertSubmission(assignmentId, studentUserId, {
    files: attachments,
    notes: notes || '',
  });
  await homeworkRepo.updateAssignment(assignmentId, { status: ASSIGNMENT_STATUS.SUBMITTED });
  await progressService.touchStudyStreak(studentUserId);
  await notificationService.notify(
    assignment.tutorUserId._id,
    'Homework submitted',
    `${assignment.title} was submitted`,
    'homework',
    { assignmentId }
  );
  await notifyParentsOfStudent(
    studentUserId,
    'Homework submitted',
    `${assignment.title} was submitted`,
    'homework',
    { assignmentId }
  );
  return submission;
}

async function grade(tutorUserId, assignmentId, body) {
  const assignment = await homeworkRepo.findAssignmentById(assignmentId);
  if (!assignment) throw new ApiError(404, 'Assignment not found');
  if (assignment.tutorUserId._id.toString() !== tutorUserId) {
    throw new ApiError(403, 'Not allowed');
  }

  const structured = normalizeGrade(
    typeof body.grade === 'object' ? body.grade : { value: body.grade },
    assignment.gradingScheme || 'ib_1_7',
    assignment.maxScore
  );

  const submission = await homeworkRepo.gradeSubmission(
    assignmentId,
    assignment.studentUserId._id,
    structured,
    body.feedback || ''
  );
  if (!submission) throw new ApiError(404, 'Submission not found');

  await homeworkRepo.updateAssignment(assignmentId, { status: ASSIGNMENT_STATUS.GRADED });
  await progressService.recordGrade({
    studentUserId: assignment.studentUserId._id,
    subjectId: assignment.subjectId._id || assignment.subjectId,
    topic: assignment.title,
    scoreLabel: structured.label,
    scoreValue: structured.ibEquivalent,
    source: 'homework',
  });
  await notificationService.notify(
    assignment.studentUserId._id,
    'Homework graded',
    `${assignment.title}: ${structured.label}`,
    'grade',
    { assignmentId }
  );
  await notifyParentsOfStudent(
    assignment.studentUserId._id,
    'Grade update',
    `${assignment.title}: ${structured.label}`,
    'grade',
    { assignmentId }
  );
  return submission;
}

module.exports = { create, list, tutorStats, getById, submit, grade };
