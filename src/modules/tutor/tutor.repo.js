const User = require('../user/user.model');
const { TutorProfile } = require('../user/profile.model');
const {
  TutorSubject,
  AvailabilitySlot,
  TutorVerification,
  TutorReview,
  StudentNote,
  LessonPlan,
  TutorVideo,
} = require('./tutor.model');

async function searchTutors(filters, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const profileQuery = { verificationStatus: 'approved' };
  if (filters.minRating) profileQuery.ratingAvg = { $gte: Number(filters.minRating) };
  if (filters.minExperience) {
    profileQuery.experienceYears = { $gte: Number(filters.minExperience) };
  }
  if (filters.maxPrice || filters.minPrice) {
    const rateCond = {};
    if (filters.minPrice) rateCond.$gte = Number(filters.minPrice);
    if (filters.maxPrice) rateCond.$lte = Number(filters.maxPrice);
    profileQuery.$or = [
      { hourlyRate: rateCond },
      { hourlyRateOnline: rateCond },
      { hourlyRateOffline: rateCond },
    ];
  }
  if (filters.language) profileQuery.languages = filters.language;
  if (filters.mode === 'online') {
    profileQuery.teachingMode = { $in: ['online', 'both'] };
  }
  if (filters.mode === 'offline') {
    profileQuery.teachingMode = { $in: ['offline', 'both'] };
    if (filters.city) profileQuery['location.city'] = new RegExp(filters.city, 'i');
    if (filters.area) profileQuery['location.area'] = new RegExp(filters.area, 'i');
  }

  let tutorUserIds = null;
  if (filters.subjectId || filters.level || filters.boardId || filters.classLevelId) {
    const tsQuery = {};
    if (filters.subjectId) tsQuery.subjectId = filters.subjectId;
    if (filters.level) tsQuery.level = filters.level;
    if (filters.boardId) tsQuery.boardId = filters.boardId;
    if (filters.classLevelId) tsQuery.classLevelId = filters.classLevelId;
    const offerings = await TutorSubject.find(tsQuery).select('tutorUserId');
    tutorUserIds = offerings.map((o) => o.tutorUserId);
    if (!tutorUserIds.length) return { items: [], total: 0, page, limit };
    profileQuery.userId = { $in: tutorUserIds };
  }

  if (filters.country) {
    const users = await User.find({
      role: 'tutor',
      country: new RegExp(filters.country, 'i'),
      status: 'active',
      ...(tutorUserIds ? { _id: { $in: tutorUserIds } } : {}),
    }).select('_id');
    profileQuery.userId = { $in: users.map((u) => u._id) };
  }

  const availableFrom = filters.availableFrom ? new Date(filters.availableFrom) : null;
  const availableTo = filters.availableTo ? new Date(filters.availableTo) : null;
  if (filters.available === 'true' || availableFrom || availableTo) {
    const slotQuery = { isBooked: false, startAt: { $gte: new Date() } };
    if (filters.mode === 'online' || filters.mode === 'offline') {
      slotQuery.deliveryMode = filters.mode;
    }
    if (availableFrom || availableTo) {
      slotQuery.startAt = {};
      if (availableFrom) slotQuery.startAt.$gte = availableFrom;
      if (availableTo) slotQuery.startAt.$lte = availableTo;
    }
    if (profileQuery.userId?.$in) {
      slotQuery.tutorUserId = { $in: profileQuery.userId.$in };
    }
    const freeSlots = await AvailabilitySlot.find(slotQuery).select('tutorUserId');
    const availableIds = [...new Set(freeSlots.map((s) => s.tutorUserId.toString()))];
    if (!availableIds.length) return { items: [], total: 0, page, limit };
    profileQuery.userId = { $in: availableIds };
  }

  const [profiles, total] = await Promise.all([
    TutorProfile.find(profileQuery)
      .populate('userId', 'name phone avatar country timezone')
      .sort({ ratingAvg: -1 })
      .skip(skip)
      .limit(limit),
    TutorProfile.countDocuments(profileQuery),
  ]);

  const ids = profiles.map((p) => p.userId?._id || p.userId);
  const subjects = await TutorSubject.find({ tutorUserId: { $in: ids } }).populate('subjectId');

  const items = profiles.map((p) => {
    const uid = (p.userId?._id || p.userId).toString();
    return {
      profile: p,
      subjects: subjects.filter((s) => s.tutorUserId.toString() === uid),
    };
  });

  return { items, total, page, limit };
}

async function getTutorDetail(tutorUserId) {
  const profile = await TutorProfile.findOne({ userId: tutorUserId }).populate(
    'userId',
    'name phone avatar country timezone'
  );
  if (!profile) return null;
  const [subjects, slots, reviews, verification, videos] = await Promise.all([
    TutorSubject.find({ tutorUserId }).populate('subjectId'),
    AvailabilitySlot.find({ tutorUserId, isBooked: false, startAt: { $gte: new Date() } }).sort({
      startAt: 1,
    }),
    TutorReview.find({ tutorUserId }).sort({ createdAt: -1 }).limit(20),
    TutorVerification.findOne({ tutorUserId }),
    TutorVideo.find({ tutorUserId, isActive: true }).sort({ createdAt: -1 }),
  ]);
  return { profile, subjects, availability: slots, reviews, verification, videos };
}

async function upsertOffering(tutorUserId, data) {
  return TutorSubject.findOneAndUpdate(
    { tutorUserId, subjectId: data.subjectId, level: data.level },
    { ...data, tutorUserId },
    { upsert: true, new: true }
  );
}

async function listOfferings(tutorUserId) {
  return TutorSubject.find({ tutorUserId }).populate('subjectId');
}

async function addAvailability(data) {
  return AvailabilitySlot.create(data);
}

async function listAvailability(tutorUserId) {
  return AvailabilitySlot.find({ tutorUserId }).sort({ startAt: 1 });
}

async function deleteAvailability(id, tutorUserId) {
  return AvailabilitySlot.findOneAndDelete({ _id: id, tutorUserId, isBooked: false });
}

async function markSlotBooked(id, isBooked = true) {
  return AvailabilitySlot.findByIdAndUpdate(id, { isBooked }, { new: true });
}

async function findSlotById(id) {
  return AvailabilitySlot.findById(id);
}

async function submitVerification(tutorUserId, data) {
  return TutorVerification.findOneAndUpdate(
    { tutorUserId },
    { ...data, tutorUserId, status: 'pending' },
    { upsert: true, new: true }
  );
}

async function findVerificationByTutor(tutorUserId) {
  return TutorVerification.findOne({ tutorUserId });
}

async function reviewVerification(tutorUserId, status, adminNote = '') {
  return TutorVerification.findOneAndUpdate(
    { tutorUserId },
    { status, adminNote, reviewedAt: new Date() },
    { new: true }
  );
}

async function setProfileVerification(tutorUserId, verificationStatus) {
  return TutorProfile.findOneAndUpdate({ userId: tutorUserId }, { verificationStatus }, { new: true });
}

async function listPendingVerifications() {
  return TutorVerification.find({ status: 'pending' }).populate('tutorUserId', 'name phone');
}

async function upsertReview(tutorUserId, studentUserId, rating, comment = '') {
  return TutorReview.findOneAndUpdate(
    { tutorUserId, studentUserId },
    { tutorUserId, studentUserId, rating, comment },
    { upsert: true, new: true }
  );
}

async function recalculateRating(tutorUserId) {
  const mongoose = require('mongoose');
  const stats = await TutorReview.aggregate([
    { $match: { tutorUserId: new mongoose.Types.ObjectId(tutorUserId) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const ratingAvg = stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0;
  const ratingCount = stats[0] ? stats[0].count : 0;
  return TutorProfile.findOneAndUpdate(
    { userId: tutorUserId },
    { ratingAvg, ratingCount },
    { new: true }
  );
}

async function createStudentNote(data) {
  return StudentNote.create(data);
}

async function listStudentNotes(tutorUserId, studentUserId) {
  const q = { tutorUserId };
  if (studentUserId) q.studentUserId = studentUserId;
  return StudentNote.find(q).sort({ createdAt: -1 });
}

async function deleteStudentNote(id, tutorUserId) {
  return StudentNote.findOneAndDelete({ _id: id, tutorUserId });
}

async function createLessonPlan(data) {
  return LessonPlan.create(data);
}

async function updateLessonPlan(id, tutorUserId, data) {
  return LessonPlan.findOneAndUpdate({ _id: id, tutorUserId }, data, { new: true });
}

async function listLessonPlans(tutorUserId, filter = {}) {
  return LessonPlan.find({ tutorUserId, ...filter })
    .populate('subjectId')
    .populate('studentUserId', 'name phone')
    .sort({ scheduledFor: 1, createdAt: -1 });
}

async function deleteLessonPlan(id, tutorUserId) {
  return LessonPlan.findOneAndDelete({ _id: id, tutorUserId });
}

async function createVideo(data) {
  return TutorVideo.create(data);
}

async function listVideos(tutorUserId) {
  return TutorVideo.find({ tutorUserId }).sort({ createdAt: -1 });
}

async function deleteVideo(id, tutorUserId) {
  return TutorVideo.findOneAndDelete({ _id: id, tutorUserId });
}

module.exports = {
  searchTutors,
  getTutorDetail,
  upsertOffering,
  listOfferings,
  addAvailability,
  listAvailability,
  deleteAvailability,
  markSlotBooked,
  findSlotById,
  submitVerification,
  findVerificationByTutor,
  reviewVerification,
  setProfileVerification,
  listPendingVerifications,
  upsertReview,
  recalculateRating,
  createStudentNote,
  listStudentNotes,
  deleteStudentNote,
  createLessonPlan,
  updateLessonPlan,
  listLessonPlans,
  deleteLessonPlan,
  createVideo,
  listVideos,
  deleteVideo,
};
