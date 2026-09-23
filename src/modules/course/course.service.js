const courseRepo = require('./course.repo');
const paymentRepo = require('../payment/payment.repo');
const { LessonPlan } = require('../tutor/tutor.model');
const ApiError = require('../../common/ApiError');
const { COURSE_STATUS, PAYMENT_STATUS, ROLES } = require('../../common/constants');

async function listMine(tutorUserId) {
  return courseRepo.list({ tutorUserId });
}

async function listPublished(query) {
  const filter = { status: COURSE_STATUS.PUBLISHED };
  if (query.tutorUserId) filter.tutorUserId = query.tutorUserId;
  if (query.subjectId) filter.subjectId = query.subjectId;
  return courseRepo.list(filter);
}

async function getById(id, user) {
  const course = await courseRepo.findById(id);
  if (!course) throw new ApiError(404, 'Course not found');
  const isOwner = user && user.id === course.tutorUserId._id.toString();
  if (course.status !== COURSE_STATUS.PUBLISHED && !isOwner && user?.role !== ROLES.ADMIN) {
    throw new ApiError(404, 'Course not found');
  }
  let enrollment = null;
  if (user?.role === ROLES.STUDENT) {
    enrollment = await courseRepo.findEnrollment(id, user.id);
  }
  return { course, enrollment };
}

async function create(tutorUserId, body, thumbnail) {
  if (body.lessonPlanIds?.length) {
    const count = await LessonPlan.countDocuments({
      _id: { $in: body.lessonPlanIds },
      tutorUserId,
    });
    if (count !== body.lessonPlanIds.length) {
      throw new ApiError(400, 'One or more lesson plans do not belong to you');
    }
  }
  return courseRepo.create({
    ...body,
    countryId: body.countryId || undefined,
    tutorUserId,
    thumbnail: thumbnail || body.thumbnail || '',
    status: body.status || COURSE_STATUS.DRAFT,
  });
}

async function update(tutorUserId, id, body, thumbnail) {
  const existing = await courseRepo.findById(id);
  if (!existing || existing.tutorUserId._id.toString() !== tutorUserId) {
    throw new ApiError(404, 'Course not found');
  }
  const patch = { ...body };
  if (typeof patch.lessonPlanIds === 'string') patch.lessonPlanIds = [patch.lessonPlanIds];
  if (thumbnail) patch.thumbnail = thumbnail;
  if (patch.countryId === '') patch.countryId = undefined;
  return courseRepo.updateById(id, patch);
}

async function publish(tutorUserId, id) {
  return update(tutorUserId, id, { status: COURSE_STATUS.PUBLISHED });
}

async function remove(tutorUserId, id) {
  const course = await courseRepo.remove(id, tutorUserId);
  if (!course) throw new ApiError(404, 'Course not found');
  return course;
}

async function enroll(user, courseId, studentUserId) {
  const course = await courseRepo.findById(courseId);
  if (!course || course.status !== COURSE_STATUS.PUBLISHED) {
    throw new ApiError(404, 'Course is not available');
  }
  const sid = user.role === ROLES.STUDENT ? user.id : studentUserId;
  if (!sid) throw new ApiError(400, 'studentUserId is required');
  if (user.role === ROLES.PARENT) {
    const parentRepo = require('../parent/parent.repo');
    const link = await parentRepo.findLink(user.id, sid);
    if (!link) throw new ApiError(403, 'Student not linked to this parent');
  } else if (user.role !== ROLES.STUDENT) {
    throw new ApiError(403, 'Not allowed');
  }

  const existing = await courseRepo.findEnrollment(courseId, sid);
  if (existing && existing.status === 'active') {
    throw new ApiError(400, 'Already enrolled');
  }

  const payment = await paymentRepo.createPayment({
    payerUserId: sid,
    beneficiaryUserId: course.tutorUserId._id || course.tutorUserId,
    courseId,
    amount: course.price,
    currency: course.currency,
    method: 'manual',
    status: course.price <= 0 ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING,
    description: `Course: ${course.title}`,
    ...(course.price <= 0 ? { paidAt: new Date() } : {}),
  });

  const enrollment = await courseRepo.upsertEnrollment({
    courseId,
    studentUserId: sid,
    paymentId: payment._id,
    status: course.price <= 0 ? 'active' : 'pending',
  });
  return { enrollment, payment };
}

async function myEnrollments(studentUserId) {
  return courseRepo.listEnrollments({ studentUserId });
}

async function activateByPayment(paymentId) {
  return courseRepo.activateByPayment(paymentId);
}

module.exports = {
  listMine,
  listPublished,
  getById,
  create,
  update,
  publish,
  remove,
  enroll,
  myEnrollments,
  activateByPayment,
};
