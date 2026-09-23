const tutorRepo = require('./tutor.repo');
const userRepo = require('../user/user.repo');
const authRepo = require('../auth/auth.repo');
const catalogRepo = require('../catalog/catalog.repo');
const notificationService = require('../notification/notification.service');
const sms = require('../../integrations/sms');
const env = require('../../config/env');
const ApiError = require('../../common/ApiError');
const {
  VERIFICATION_STATUS,
  VERIFICATION_DOC_FIELDS,
  VERIFICATION_REQUIRED_FIELDS,
  VERIFICATION_MIN_REFERENCES,
  VERIFICATION_MAX_FILES_PER_FIELD,
} = require('../../common/constants');
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
  const { timezone, country, name, email, avatar, ...profileData } = data;
  const userPatch = {
    ...(timezone !== undefined && timezone !== '' && { timezone }),
    ...(country !== undefined && { country }),
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(avatar !== undefined && { avatar }),
  };
  if (Object.keys(userPatch).length) {
    await userRepo.updateById(userId, userPatch);
  }
  return userRepo.updateTutorProfile(userId, profileData);
}

function assertTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    throw new ApiError(400, `Unknown timezone: ${tz}`);
  }
}

async function addSubjectOffering(userId, body) {
  const data = { ...body };
  ['countryId', 'boardId', 'classLevelId'].forEach((k) => {
    if (!data[k]) data[k] = undefined;
  });
  if (data.countryId) {
    const country = await catalogRepo.findCountryById(data.countryId);
    if (!country) throw new ApiError(400, 'Unknown country');
    if (!data.currency) data.currency = country.currency;
  }
  if (data.boardId) {
    const board = await catalogRepo.findBoardById(data.boardId);
    if (!board) throw new ApiError(400, 'Unknown board');
    const boardCountry = board.countryId?.toString();
    if (data.countryId && boardCountry && boardCountry !== String(data.countryId)) {
      throw new ApiError(400, 'Board is not offered in the selected country');
    }
    if (!data.countryId && boardCountry) data.countryId = boardCountry;
  }
  if (data.classLevelId) {
    const classLevel = await catalogRepo.findClassLevelById(data.classLevelId);
    if (!classLevel) throw new ApiError(400, 'Unknown class');
    const classCountry = classLevel.countryId?.toString();
    if (data.countryId && classCountry && classCountry !== String(data.countryId)) {
      throw new ApiError(400, 'Class is not offered in the selected country');
    }
    if (!data.countryId && classCountry) data.countryId = classCountry;
  }
  if (!data.currency) {
    const profile = await userRepo.getTutorProfile(userId);
    data.currency = profile?.currency || 'USD';
  }
  const online = data.onlineRate ?? data.hourlyRate ?? 0;
  data.onlineRate = online;
  data.offlineRate = data.offlineRate ?? online;
  data.hourlyRate = data.hourlyRate ?? online;
  return tutorRepo.upsertOffering(userId, data);
}

async function myOfferings(userId) {
  return tutorRepo.listOfferings(userId);
}

async function removeOffering(userId, id) {
  const offering = await tutorRepo.deleteOffering(id, userId);
  if (!offering) throw new ApiError(404, 'Offering not found');
  return offering;
}

async function addAvailability(userId, body) {
  const user = await userRepo.findById(userId);
  let countryTz = '';
  if (body.countryId) {
    const country = await catalogRepo.findCountryById(body.countryId);
    countryTz = country?.defaultTimezone || '';
  }
  const tz = body.timezone || user?.timezone || countryTz || 'UTC';
  assertTimezone(tz);
  const startAt = toUtc(body.startAt, tz);
  const endAt = toUtc(body.endAt, tz);
  if (endAt <= startAt) throw new ApiError(400, 'endAt must be after startAt');
  if (startAt <= new Date()) throw new ApiError(400, 'Slot must start in the future');

  const overlap = await tutorRepo.findSlotOverlap(userId, startAt, endAt);
  if (overlap) throw new ApiError(409, 'This slot overlaps another of your slots');

  const deliveryMode = body.deliveryMode === 'offline' ? 'offline' : 'online';
  let location;
  if (deliveryMode === 'offline') {
    const profile = await userRepo.getTutorProfile(userId);
    const fallback = profile?.location || {};
    location = {
      label: body.location?.label || '',
      city: body.location?.city || fallback.city || '',
      area: body.location?.area || fallback.area || '',
      address: body.location?.address || fallback.address || '',
      lat: body.location?.lat ?? fallback.lat,
      lng: body.location?.lng ?? fallback.lng,
    };
    if (!location.city && !location.address) {
      throw new ApiError(400, 'Offline slots need a location (city or address)');
    }
  }

  return tutorRepo.addAvailability({
    tutorUserId: userId,
    startAt,
    endAt,
    timezone: tz,
    deliveryMode,
    countryId: body.countryId || undefined,
    location,
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

// Folds legacy single-file fields into the documents arrays so old records keep working.
function migrateLegacyDocs(verification) {
  let changed = false;
  for (const field of VERIFICATION_DOC_FIELDS) {
    const legacyKey = `${field}Doc`;
    const legacy = verification[legacyKey];
    if (!legacy) continue;
    const list = verification.documents[field];
    if (!list.some((d) => d.url === legacy)) {
      list.push({
        url: legacy,
        name: legacy.split('/').pop(),
        status: verification.status === 'approved' ? 'approved' : 'pending',
        uploadedAt: verification.updatedAt || new Date(),
      });
    }
    verification[legacyKey] = '';
    changed = true;
  }
  return changed;
}

async function loadVerification(tutorUserId, create = false) {
  const verification = create
    ? await tutorRepo.getOrCreateVerification(tutorUserId)
    : await tutorRepo.findVerificationByTutor(tutorUserId);
  if (!verification) return null;
  if (migrateLegacyDocs(verification)) await verification.save();
  return verification;
}

function referenceOtpKey(tutorUserId, phone) {
  return `ref:${tutorUserId}:${phone}`;
}

async function getMyVerification(tutorUserId) {
  const verification = await loadVerification(tutorUserId, true);
  return {
    verification,
    requirements: {
      requiredFields: VERIFICATION_REQUIRED_FIELDS,
      minReferences: VERIFICATION_MIN_REFERENCES,
      maxFilesPerField: VERIFICATION_MAX_FILES_PER_FIELD,
    },
  };
}

async function saveReferences(tutorUserId, references) {
  const verification = await loadVerification(tutorUserId, true);
  const previous = verification.references || [];
  verification.references = references.map((ref) => {
    const phone = String(ref.phone).trim();
    const match = previous.find((p) => p.phone === phone);
    return {
      name: ref.name,
      relation: ref.relation || '',
      phone,
      email: ref.email || '',
      otpVerified: Boolean(match?.otpVerified),
      verifiedAt: match?.verifiedAt,
    };
  });
  const ownPhone = (await userRepo.findById(tutorUserId))?.phone;
  if (verification.references.some((r) => r.phone === ownPhone)) {
    throw new ApiError(400, 'A reference cannot use your own phone number');
  }
  const phones = verification.references.map((r) => r.phone);
  if (new Set(phones).size !== phones.length) {
    throw new ApiError(400, 'Each reference needs a different phone number');
  }
  await verification.save();
  return verification;
}

async function sendReferenceOtp(tutorUserId, idx) {
  const verification = await loadVerification(tutorUserId);
  const ref = verification?.references?.[idx];
  if (!ref) throw new ApiError(404, 'Reference not found. Save references first.');
  if (ref.otpVerified) throw new ApiError(400, 'Reference already verified');
  const sent = await sms.sendOtp(ref.phone);
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000);
  await authRepo.upsertOtp(referenceOtpKey(tutorUserId, ref.phone), sent.code, expiresAt);
  return {
    phone: ref.phone,
    expiresAt,
    message: `OTP sent to ${ref.name}`,
    demoOtp: sent.demo && env.nodeEnv === 'development' ? sent.code : undefined,
  };
}

async function verifyReferenceOtp(tutorUserId, idx, otp) {
  const verification = await loadVerification(tutorUserId);
  const ref = verification?.references?.[idx];
  if (!ref) throw new ApiError(404, 'Reference not found');
  const key = referenceOtpKey(tutorUserId, ref.phone);
  const session = await authRepo.findOtp(key);
  if (!session || session.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, 'OTP expired or not requested');
  }
  if (String(otp) !== session.code) throw new ApiError(400, 'Invalid OTP');
  ref.otpVerified = true;
  ref.verifiedAt = new Date();
  await verification.save();
  await authRepo.deleteOtp(key);
  return verification;
}

function fileToDoc(file) {
  return {
    url: storedFileUrl(file),
    name: file.originalname || '',
    mimeType: file.mimetype || '',
    uploadedAt: new Date(),
    status: 'pending',
  };
}

async function submitVerification(tutorUserId, files, notes) {
  const verification = await loadVerification(tutorUserId, true);
  for (const field of VERIFICATION_DOC_FIELDS) {
    const incoming = [...(files[field] || []), ...(files[`${field}Doc`] || [])];
    if (!incoming.length) continue;
    const list = verification.documents[field];
    const live = list.filter((d) => d.status !== 'rejected').length;
    if (live + incoming.length > VERIFICATION_MAX_FILES_PER_FIELD) {
      throw new ApiError(400, `At most ${VERIFICATION_MAX_FILES_PER_FIELD} files allowed for ${field}`);
    }
    incoming.forEach((f) => list.push(fileToDoc(f)));
  }

  for (const field of VERIFICATION_REQUIRED_FIELDS) {
    if (!verification.documents[field].some((d) => d.status !== 'rejected')) {
      throw new ApiError(400, `Upload at least one ${field} document`);
    }
  }
  const verifiedRefs = (verification.references || []).filter((r) => r.otpVerified).length;
  if (verifiedRefs < VERIFICATION_MIN_REFERENCES) {
    throw new ApiError(
      400,
      `Add at least ${VERIFICATION_MIN_REFERENCES} references and verify their phone numbers with OTP`
    );
  }

  if (notes !== undefined) verification.notes = notes || '';
  verification.status = VERIFICATION_STATUS.PENDING;
  verification.rejectReason = '';
  verification.submittedAt = new Date();
  await verification.save();
  await tutorRepo.setProfileVerification(tutorUserId, VERIFICATION_STATUS.PENDING);
  return verification;
}

async function removeVerificationDocument(tutorUserId, field, docId) {
  if (!VERIFICATION_DOC_FIELDS.includes(field)) throw new ApiError(400, 'Unknown document field');
  const verification = await loadVerification(tutorUserId);
  const doc = verification?.documents?.[field]?.id(docId);
  if (!doc) throw new ApiError(404, 'Document not found');
  if (doc.status === 'approved') throw new ApiError(400, 'Approved documents cannot be removed');
  doc.deleteOne();
  await verification.save();
  return verification;
}

async function adminReviewVerification(tutorUserId, body) {
  const { status, rejectReason = '', adminNote = '', documents = [] } = body;
  const verification = await loadVerification(tutorUserId);
  if (!verification) throw new ApiError(404, 'Verification not found');

  for (const decision of documents) {
    const doc = verification.documents?.[decision.field]?.id(decision.docId);
    if (!doc) throw new ApiError(404, `Document ${decision.docId} not found`);
    if (decision.status === 'rejected' && !decision.rejectReason) {
      throw new ApiError(400, 'Each rejected document needs a reason');
    }
    doc.status = decision.status;
    doc.rejectReason = decision.status === 'rejected' ? decision.rejectReason : '';
  }

  if (status === VERIFICATION_STATUS.REJECTED && !rejectReason) {
    throw new ApiError(400, 'A rejection reason is required');
  }
  if (status === VERIFICATION_STATUS.APPROVED) {
    const rejectedDocs = VERIFICATION_DOC_FIELDS.flatMap((f) =>
      verification.documents[f].filter((d) => d.status === 'rejected')
    );
    if (rejectedDocs.length) {
      throw new ApiError(400, 'Cannot approve while documents are rejected. Reject the request instead.');
    }
    VERIFICATION_DOC_FIELDS.forEach((f) =>
      verification.documents[f].forEach((d) => {
        if (d.status === 'pending') d.status = 'approved';
      })
    );
  }

  verification.status = status;
  verification.rejectReason = status === VERIFICATION_STATUS.REJECTED ? rejectReason : '';
  verification.adminNote = adminNote;
  verification.reviewedAt = new Date();
  await verification.save();
  await tutorRepo.setProfileVerification(tutorUserId, status);

  const reasonText = status === VERIFICATION_STATUS.REJECTED ? ` Reason: ${rejectReason}` : '';
  await notificationService.notify(
    tutorUserId,
    'Verification update',
    `Your tutor verification was ${status}.${reasonText}`,
    'verification',
    { status, rejectReason: verification.rejectReason }
  );
  return verification;
}

async function listVerifications(status) {
  let filter = { status: VERIFICATION_STATUS.PENDING };
  if (status === 'all') filter = { status: { $ne: VERIFICATION_STATUS.NOT_SUBMITTED } };
  else if (status) filter = { status };
  const items = await tutorRepo.listVerifications(filter);
  for (const v of items) {
    if (migrateLegacyDocs(v)) await v.save();
  }
  return items;
}

async function pendingVerifications() {
  return listVerifications('pending');
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

async function getLessonPlan(tutorUserId, id) {
  const plan = await tutorRepo.findLessonPlan(id, tutorUserId);
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
  removeOffering,
  addAvailability,
  myAvailability,
  removeAvailability,
  getMyVerification,
  saveReferences,
  sendReferenceOtp,
  verifyReferenceOtp,
  submitVerification,
  removeVerificationDocument,
  adminReviewVerification,
  listVerifications,
  pendingVerifications,
  addReview,
  addStudentNote,
  listStudentNotes,
  removeStudentNote,
  addLessonPlan,
  updateLessonPlan,
  getLessonPlan,
  listLessonPlans,
  removeLessonPlan,
  addVideo,
  myVideos,
  removeVideo,
};
