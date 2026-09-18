const tutorRepo = require('./tutor.repo');
const userRepo = require('../user/user.repo');
const notificationService = require('../notification/notification.service');
const ApiError = require('../../common/ApiError');
const { toUtc } = require('../../utils/time');
const { sanitizeTutorPayload, sanitizeTutorSearchItems } = require('../../utils/tutorPrivacy');
const { storedFileUrl } = require('../../utils/mediaUrl');

async function search(query, role) {
  const data = await tutorRepo.searchTutors(query, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
  return { ...data, items: sanitizeTutorSearchItems(data.items, role) };
}

async function getById(id, role) {
  const data = await tutorRepo.getTutorDetail(id);
  if (!data) throw new ApiError(404, 'Tutor not found');
  return sanitizeTutorPayload(data, role);
}

async function updateMyProfile(userId, data) {
  return userRepo.updateTutorProfile(userId, data);
}

async function addSubjectOffering(userId, data) {
  return tutorRepo.upsertOffering(userId, data);
}

async function myOfferings(userId) {
  return tutorRepo.listOfferings(userId);
}

async function addAvailability(userId, body) {
  const tz = body.timezone || 'UTC';
  const startAt = toUtc(body.startAt, tz);
  const endAt = toUtc(body.endAt, tz);
  if (endAt <= startAt) throw new ApiError(400, 'endAt must be after startAt');
  return tutorRepo.addAvailability({
    tutorUserId: userId,
    startAt,
    endAt,
    timezone: tz,
    deliveryMode: body.deliveryMode === 'offline' ? 'offline' : 'online',
  });
}

async function myAvailability(userId) {
  return tutorRepo.listAvailability(userId);
}

async function removeAvailability(userId, id) {
  const slot = await tutorRepo.deleteAvailability(id, userId);
  if (!slot) throw new ApiError(404, 'Slot not found or already booked');
  return slot;
}

function uploadPath(file) {
  return storedFileUrl(file);
}

async function submitVerification(userId, files, notes) {
  const data = {
    notes: notes || '',
    identityDoc: uploadPath(files.identityDoc?.[0]),
    degreeDoc: uploadPath(files.degreeDoc?.[0]),
    certificateDoc: uploadPath(files.certificateDoc?.[0]),
    resumeDoc: uploadPath(files.resumeDoc?.[0]),
  };
  // Keep existing docs when a field is omitted on re-submit
  const existing = await tutorRepo.findVerificationByTutor(userId);
  if (existing) {
    for (const key of ['identityDoc', 'degreeDoc', 'certificateDoc', 'resumeDoc']) {
      if (!data[key]) data[key] = existing[key] || '';
    }
  }
  const verification = await tutorRepo.submitVerification(userId, data);
  await tutorRepo.setProfileVerification(userId, 'pending');
  return verification;
}

async function adminReviewVerification(tutorUserId, status, adminNote) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Status must be approved or rejected');
  }
  const verification = await tutorRepo.reviewVerification(tutorUserId, status, adminNote);
  if (!verification) throw new ApiError(404, 'Verification not found');
  await tutorRepo.setProfileVerification(tutorUserId, status);
  await notificationService.notify(
    tutorUserId,
    'Verification update',
    `Your tutor verification was ${status}`,
    'verification',
    { status }
  );
  return verification;
}

async function pendingVerifications() {
  return tutorRepo.listPendingVerifications();
}

async function addReview(studentUserId, tutorUserId, body) {
  if (studentUserId === tutorUserId) {
    throw new ApiError(400, 'Cannot review yourself');
  }
  const tutorProfile = await userRepo.getTutorProfile(tutorUserId);
  if (!tutorProfile) throw new ApiError(404, 'Tutor not found');

  const bookingRepo = require('../booking/booking.repo');
  const paymentRepo = require('../payment/payment.repo');
  const bookings = await bookingRepo.list(
    { studentUserId, tutorUserId, status: 'completed' },
    { page: 1, limit: 20 }
  );
  const bookingIds = (bookings.items || []).map((b) => b._id);
  const paid = bookingIds.length
    ? await paymentRepo.listPayments({
        bookingId: { $in: bookingIds },
        status: 'paid',
      })
    : { total: 0 };
  if (!paid.total) {
    throw new ApiError(403, 'You can only review a tutor after a completed paid session');
  }

  const review = await tutorRepo.upsertReview(
    tutorUserId,
    studentUserId,
    body.rating,
    body.comment || ''
  );
  const profile = await tutorRepo.recalculateRating(tutorUserId);
  return { review, ratingAvg: profile?.ratingAvg, ratingCount: profile?.ratingCount };
}

async function addStudentNote(tutorUserId, body) {
  return tutorRepo.createStudentNote({
    tutorUserId,
    studentUserId: body.studentUserId,
    note: body.note,
    tags: body.tags || [],
  });
}

async function listStudentNotes(tutorUserId, studentUserId) {
  return tutorRepo.listStudentNotes(tutorUserId, studentUserId);
}

async function removeStudentNote(tutorUserId, id) {
  const note = await tutorRepo.deleteStudentNote(id, tutorUserId);
  if (!note) throw new ApiError(404, 'Note not found');
  return note;
}

async function addLessonPlan(tutorUserId, body) {
  return tutorRepo.createLessonPlan({ ...body, tutorUserId });
}

async function updateLessonPlan(tutorUserId, id, body) {
  const plan = await tutorRepo.updateLessonPlan(id, tutorUserId, body);
  if (!plan) throw new ApiError(404, 'Lesson plan not found');
  return plan;
}

async function listLessonPlans(tutorUserId, query) {
  const filter = {};
  if (query.studentUserId) filter.studentUserId = query.studentUserId;
  if (query.status) filter.status = query.status;
  return tutorRepo.listLessonPlans(tutorUserId, filter);
}

async function removeLessonPlan(tutorUserId, id) {
  const plan = await tutorRepo.deleteLessonPlan(id, tutorUserId);
  if (!plan) throw new ApiError(404, 'Lesson plan not found');
  return plan;
}

async function addVideo(tutorUserId, body) {
  if (!body.fileUrl) throw new ApiError(400, 'Upload a file or provide a video URL');
  return tutorRepo.createVideo({
    tutorUserId,
    title: body.title,
    kind: body.kind || 'intro',
    fileUrl: body.fileUrl,
  });
}

async function myVideos(tutorUserId) {
  return tutorRepo.listVideos(tutorUserId);
}

async function removeVideo(tutorUserId, id) {
  const video = await tutorRepo.deleteVideo(id, tutorUserId);
  if (!video) throw new ApiError(404, 'Video not found');
  return video;
}

module.exports = {
  search,
  getById,
  updateMyProfile,
  addSubjectOffering,
  myOfferings,
  addAvailability,
  myAvailability,
  removeAvailability,
  submitVerification,
  adminReviewVerification,
  pendingVerifications,
  addReview,
  addStudentNote,
  listStudentNotes,
  removeStudentNote,
  addLessonPlan,
  updateLessonPlan,
  listLessonPlans,
  removeLessonPlan,
  addVideo,
  myVideos,
  removeVideo,
};
