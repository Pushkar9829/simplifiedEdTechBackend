const homeworkRepo = require('./homework.repo');
const progressService = require('../progress/progress.service');
const notificationService = require('../notification/notification.service');
const parentRepo = require('../parent/parent.repo');
const { notifyParentsOfStudent } = require('../../utils/parentNotify');
const ApiError = require('../../common/ApiError');
const { sanitizeAssignment } = require('../../utils/tutorPrivacy');
const { ASSIGNMENT_STATUS, ROLES } = require('../../common/constants');
const { storedFileUrl } = require('../../utils/mediaUrl');

async function create(tutorUserId, body) {
  const assignment = await homeworkRepo.createAssignment({
    ...body,
    tutorUserId,
    status: ASSIGNMENT_STATUS.ASSIGNED,
  });
  await notificationService.notify(
    body.studentUserId,
    'New homework',
    `Assignment: ${body.title}`,
    'homework',
    { assignmentId: assignment._id }
  );
  await notifyParentsOfStudent(
    body.studentUserId,
    'New homework assigned',
    `Assignment: ${body.title}`,
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
  if (query.status) filter.status = query.status;
  return homeworkRepo.listAssignments(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
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

  const fileNames = (files || []).map((f) => storedFileUrl(f)).filter(Boolean);
  const submission = await homeworkRepo.upsertSubmission(assignmentId, studentUserId, {
    files: fileNames,
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

  const submission = await homeworkRepo.gradeSubmission(
    assignmentId,
    assignment.studentUserId._id,
    body.grade,
    body.feedback || ''
  );
  if (!submission) throw new ApiError(404, 'Submission not found');

  await homeworkRepo.updateAssignment(assignmentId, { status: ASSIGNMENT_STATUS.GRADED });
  await progressService.recordGrade({
    studentUserId: assignment.studentUserId._id,
    subjectId: assignment.subjectId._id || assignment.subjectId,
    topic: assignment.title,
    scoreLabel: body.grade,
    source: 'homework',
  });
  await notificationService.notify(
    assignment.studentUserId._id,
    'Homework graded',
    `${assignment.title}: ${body.grade}`,
    'grade',
    { assignmentId }
  );
  await notifyParentsOfStudent(
    assignment.studentUserId._id,
    'Grade update',
    `${assignment.title}: ${body.grade}`,
    'grade',
    { assignmentId }
  );
  return submission;
}

module.exports = { create, list, getById, submit, grade };
