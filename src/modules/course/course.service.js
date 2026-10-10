const courseRepo = require('./course.repo');
const paymentRepo = require('../payment/payment.repo');
const { LessonPlan } = require('../tutor/tutor.model');
const ApiError = require('../../common/ApiError');
const { COURSE_STATUS, PAYMENT_STATUS, ROLES } = require('../../common/constants');
const { hideTutorContact, stripContact } = require('../../utils/tutorPrivacy');

function hideCourseTutor(course, role) {
  if (!course || !hideTutorContact(role)) return course;
  const row = typeof course.toObject === 'function' ? course.toObject() : { ...course };
  if (row.tutorUserId) row.tutorUserId = stripContact(row.tutorUserId);
  return row;
}

async function listMine(tutorUserId) {
  return courseRepo.list({ tutorUserId });
}

async function listPublished(query, user) {
  const role = user?.role;
  const filter = { status: COURSE_STATUS.PUBLISHED };
  if (query.tutorUserId) filter.tutorUserId = query.tutorUserId;
  if (query.subjectId) filter.subjectId = query.subjectId;
  if (query.level) filter.level = query.level;
  if (query.countryId) filter.countryId = query.countryId;
  if (query.paid === 'free') filter.price = 0;
  if (query.paid === 'paid') filter.price = { $gt: 0 };
  if (query.minPrice) filter.price = { ...(typeof filter.price === 'object' ? filter.price : {}), $gte: Number(query.minPrice) };
  if (query.maxPrice) filter.price = { ...(typeof filter.price === 'object' ? filter.price : {}), $lte: Number(query.maxPrice) };
  if (query.search) {
    const escaped = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ title: new RegExp(escaped, 'i') }, { description: new RegExp(escaped, 'i') }];
  }
  const FavoriteItem = require('../favorite/favorite.model');
  if (query.favorites === 'true' && user?.id) {
    const favs = await FavoriteItem.find({ userId: user.id, kind: 'course' }).select('targetId');
    filter._id = { $in: favs.map((f) => f.targetId) };
    if (!favs.length) return [];
  }
  const items = await courseRepo.list(filter);
  const favIds = user?.id
    ? new Set(
        (await FavoriteItem.find({ userId: user.id, kind: 'course' }).select('targetId')).map((f) =>
          String(f.targetId)
        )
      )
    : new Set();
  return items
    .filter((c) => {
      if (!query.category) return true;
      return (c.subjectId?.category || 'ibdp') === query.category;
    })
    .map((c) => {
      const row = hideCourseTutor(c, role);
      const next = typeof row.toObject === 'function' ? row.toObject() : { ...row };
      next.favorite = favIds.has(String(next._id));
      return next;
    });
}

async function getById(id, user) {
  const course = await courseRepo.findById(id);
  if (!course) throw new ApiError(404, 'Course not found');
  const isOwner = user && user.id === String(course.tutorUserId?._id || course.tutorUserId);
  if (course.status !== COURSE_STATUS.PUBLISHED && !isOwner && user?.role !== ROLES.ADMIN) {
    throw new ApiError(404, 'Course not found');
  }
  let enrollment = null;
  if (user?.role === ROLES.STUDENT) {
    enrollment = await courseRepo.findEnrollment(id, user.id);
  }
  return { course: hideCourseTutor(course, user?.role), enrollment };
}

async function assertOwnLessonPlans(tutorUserId, lessonPlanIds) {
  if (!lessonPlanIds?.length) return;
  const count = await LessonPlan.countDocuments({ _id: { $in: lessonPlanIds }, tutorUserId });
  if (count !== lessonPlanIds.length) {
    throw new ApiError(400, 'One or more lesson plans do not belong to you');
  }
}

async function create(tutorUserId, body, thumbnail) {
  await assertOwnLessonPlans(tutorUserId, body.lessonPlanIds);
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
  if (!existing || String(existing.tutorUserId?._id || existing.tutorUserId) !== tutorUserId) {
    throw new ApiError(404, 'Course not found');
  }
  const patch = { ...body };
  delete patch.tutorUserId;
  if (typeof patch.lessonPlanIds === 'string') patch.lessonPlanIds = [patch.lessonPlanIds];
  await assertOwnLessonPlans(tutorUserId, patch.lessonPlanIds);
  if (thumbnail) patch.thumbnail = thumbnail;
  if (patch.countryId === '') patch.countryId = null;
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
  // Reuse the open invoice instead of orphaning it with a second one.
  if (existing?.paymentId) {
    const open = await paymentRepo.findPaymentById(existing.paymentId);
    if (open && ['pending', 'failed', 'awaiting_confirmation'].includes(open.status)) {
      return { enrollment: existing, payment: open };
    }
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

async function myEnrollments(user) {
  const role = user?.role || 'student';
  const filter = {};
  if (role === ROLES.PARENT) {
    const parentRepo = require('../parent/parent.repo');
    const ids = await parentRepo.listLinkedStudentIds(user.id);
    filter.studentUserId = { $in: ids };
  } else {
    filter.studentUserId = user.id || user;
  }
  const rows = await courseRepo.listEnrollments(filter);
  return rows.map((row) => {
    const next = typeof row.toObject === 'function' ? row.toObject() : { ...row };
    if (next.courseId) next.courseId = hideCourseTutor(next.courseId, role);
    return next;
  });
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
