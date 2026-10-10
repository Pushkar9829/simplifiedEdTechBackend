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
const { escapeRegex } = require('../../utils/regex');

// A slot can be unflagged yet still clash with a booking made by time (not by slot); hide those.
async function withoutBookedOverlaps(tutorUserId, slots) {
  if (!slots.length) return slots;
  const Booking = require('../booking/booking.model');
  const first = slots.reduce((m, s) => (s.startAt < m ? s.startAt : m), slots[0].startAt);
  const last = slots.reduce((m, s) => (s.endAt > m ? s.endAt : m), slots[0].endAt);
  const bookings = await Booking.find({
    tutorUserId,
    status: { $ne: 'cancelled' },
    startAt: { $lt: last },
    endAt: { $gt: first },
  }).select('startAt endAt');
  if (!bookings.length) return slots;
  return slots.filter((s) => !bookings.some((b) => b.startAt < s.endAt && b.endAt > s.startAt));
}

function validTimezone(tz) {
  if (!tz || typeof tz !== 'string') return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

async function searchTutors(filters, options = {}) {
  const page = Math.max(1, Math.floor(Number(options.page)) || 1);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(options.limit)) || 20));
  const skip = (page - 1) * limit;
  const empty = { items: [], total: 0, page, limit };

  // null = unrestricted; otherwise the set of tutor user ids still eligible.
  let allowedIds = null;
  const restrictTo = (ids) => {
    const next = [...new Set(ids.map(String))];
    if (allowedIds) {
      const current = new Set(allowedIds);
      allowedIds = next.filter((id) => current.has(id));
    } else {
      allowedIds = next;
    }
    return allowedIds.length > 0;
  };

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
  if (filters.needBased === 'true' || filters.needBased === 'yes') {
    profileQuery.needBasedClasses = { $ne: false };
  }
  if (filters.needBased === 'false' || filters.needBased === 'no') {
    profileQuery.needBasedClasses = false;
  }
  if (filters.mode === 'online') {
    profileQuery.teachingMode = { $in: ['online', 'both'] };
  }
  if (filters.mode === 'offline') {
    profileQuery.teachingMode = { $in: ['offline', 'both'] };
    if (filters.city) profileQuery['location.city'] = new RegExp(escapeRegex(filters.city), 'i');
    if (filters.state) profileQuery['location.state'] = new RegExp(escapeRegex(filters.state), 'i');
    if (filters.area) profileQuery['location.area'] = new RegExp(escapeRegex(filters.area), 'i');
  }

  if (filters.subjectId || filters.level || filters.boardId || filters.classLevelId || filters.category) {
    const tsQuery = {};
    if (filters.subjectId) tsQuery.subjectId = filters.subjectId;
    if (filters.level) tsQuery.level = filters.level;
    if (filters.boardId) tsQuery.boardId = filters.boardId;
    if (filters.classLevelId) tsQuery.classLevelId = filters.classLevelId;
    if (filters.category) {
      const Subject = require('../subject/subject.model');
      const cats = await Subject.find({ category: filters.category, isActive: true }).select('_id');
      tsQuery.subjectId = tsQuery.subjectId
        ? { $eq: tsQuery.subjectId }
        : { $in: cats.map((s) => s._id) };
      if (tsQuery.subjectId.$in && !tsQuery.subjectId.$in.length) return empty;
    }
    const offerings = await TutorSubject.find(tsQuery).select('tutorUserId');
    if (!restrictTo(offerings.map((o) => o.tutorUserId))) return empty;
  }

  if (filters.favoriteIds) {
    if (!restrictTo(filters.favoriteIds)) return empty;
  }

  const excluded = (filters.excludeIds || []).map(String);
  const userMatch = { role: 'tutor', status: 'active' };
  const idCond = {};
  if (allowedIds) idCond.$in = allowedIds;
  if (excluded.length) idCond.$nin = excluded;
  if (Object.keys(idCond).length) userMatch._id = idCond;
  const nameQuery = String(filters.search || filters.q || '').trim();
  if (nameQuery) {
    const nameRe = new RegExp(escapeRegex(nameQuery), 'i');
    if (filters.hideTutorName) userMatch.refCode = nameRe;
    else userMatch.$or = [{ name: nameRe }, { refCode: nameRe }];
  }
  if (filters.country) userMatch.country = new RegExp(escapeRegex(filters.country), 'i');
  const activeTutors = await User.find(userMatch).select('_id');
  allowedIds = activeTutors.map((u) => String(u._id));
  if (!allowedIds.length) return empty;

  const availableFrom = filters.availableFrom ? new Date(filters.availableFrom) : null;
  const availableTo = filters.availableTo ? new Date(filters.availableTo) : null;
  if (filters.available === 'true' || availableFrom || availableTo || filters.timeSlot) {
    const slotQuery = { isBooked: false, startAt: { $gte: new Date() } };
    if (filters.mode === 'online' || filters.mode === 'offline') {
      slotQuery.deliveryMode = filters.mode;
    }
    if (availableFrom || availableTo) {
      slotQuery.startAt = {};
      if (availableFrom) slotQuery.startAt.$gte = availableFrom;
      if (availableTo) slotQuery.startAt.$lte = availableTo;
    }
    if (filters.timeSlot) {
      const hours =
        filters.timeSlot === 'morning'
          ? [6, 12]
          : filters.timeSlot === 'afternoon'
            ? [12, 17]
            : filters.timeSlot === 'evening'
              ? [17, 22]
              : null;
      if (hours) {
        const hour = { $hour: { date: '$startAt', timezone: validTimezone(filters.timezone) } };
        slotQuery.$expr = {
          $and: [{ $gte: [hour, hours[0]] }, { $lt: [hour, hours[1]] }],
        };
      }
    }
    slotQuery.tutorUserId = { $in: allowedIds };
    const freeSlots = await AvailabilitySlot.find(slotQuery).select('tutorUserId');
    if (!restrictTo(freeSlots.map((s) => s.tutorUserId))) return empty;
  }

  profileQuery.userId = { $in: allowedIds };

  await TutorProfile.updateMany(
    { isPremium: true, premiumUntil: { $lte: new Date() } },
    { isPremium: false, premiumRank: 0 }
  );

  const [profiles, total] = await Promise.all([
    TutorProfile.find(profileQuery)
      .populate('userId', 'name avatar country timezone refCode')
      .sort({ isPremium: -1, premiumRank: -1, ratingAvg: -1 })
      .skip(skip)
      .limit(limit),
    TutorProfile.countDocuments(profileQuery),
  ]);

  const ids = profiles.map((p) => p.userId?._id || p.userId).filter(Boolean);
  const subjects = await TutorSubject.find({ tutorUserId: { $in: ids } }).populate('subjectId');

  const items = profiles
    .filter((p) => p.userId)
    .map((p) => {
      const uid = String(p.userId._id || p.userId);
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
    'name avatar country timezone refCode'
  );
  if (!profile) return null;
  const [subjects, slots, reviews, verification, videos] = await Promise.all([
    TutorSubject.find({ tutorUserId })
      .populate('subjectId')
      .populate('boardId', 'name')
      .populate('classLevelId', 'name')
      .populate('countryId', 'name code currency'),
    AvailabilitySlot.find({ tutorUserId, isBooked: false, startAt: { $gte: new Date() } }).sort({
      startAt: 1,
    }),
    TutorReview.find({ tutorUserId }).sort({ createdAt: -1 }).limit(20),
    TutorVerification.findOne({ tutorUserId }),
    TutorVideo.find({ tutorUserId, isActive: true }).sort({ createdAt: -1 }),
  ]);
  return {
    profile,
    subjects,
    availability: await withoutBookedOverlaps(tutorUserId, slots),
    reviews,
    verification,
    videos,
  };
}

async function upsertOffering(tutorUserId, data) {
  return TutorSubject.findOneAndUpdate(
    { tutorUserId, subjectId: data.subjectId, level: data.level },
    { ...data, tutorUserId },
    { upsert: true, new: true }
  );
}

async function listOfferings(tutorUserId) {
  return TutorSubject.find({ tutorUserId })
    .populate('subjectId')
    .populate('boardId', 'name code')
    .populate('classLevelId', 'name')
    .populate('countryId', 'name code currency currencySymbol');
}

async function deleteOffering(id, tutorUserId) {
  return TutorSubject.findOneAndDelete({ _id: id, tutorUserId });
}

async function findOffering(tutorUserId, subjectId, level) {
  return TutorSubject.findOne({ tutorUserId, subjectId, ...(level ? { level } : {}) });
}

async function addAvailability(data) {
  return AvailabilitySlot.create(data);
}

async function listAvailability(tutorUserId) {
  return AvailabilitySlot.find({ tutorUserId })
    .populate('countryId', 'name code')
    .sort({ startAt: 1 });
}

async function findSlotOverlap(tutorUserId, startAt, endAt) {
  return AvailabilitySlot.findOne({
    tutorUserId,
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  });
}

async function deleteAvailability(id, tutorUserId) {
  return AvailabilitySlot.findOneAndDelete({ _id: id, tutorUserId, isBooked: false });
}

async function markSlotBooked(id, isBooked = true) {
  return AvailabilitySlot.findByIdAndUpdate(id, { isBooked }, { new: true });
}

// Atomically take a free slot; returns null if someone else already booked it.
async function claimSlot(id) {
  return AvailabilitySlot.findOneAndUpdate({ _id: id, isBooked: false }, { isBooked: true }, { new: true });
}

async function findSlotById(id) {
  return AvailabilitySlot.findById(id);
}

async function findVerificationByTutor(tutorUserId) {
  return TutorVerification.findOne({ tutorUserId });
}

async function getOrCreateVerification(tutorUserId) {
  return TutorVerification.findOneAndUpdate(
    { tutorUserId },
    { $setOnInsert: { tutorUserId } },
    { upsert: true, new: true }
  );
}

async function setProfileVerification(tutorUserId, verificationStatus) {
  return TutorProfile.findOneAndUpdate({ userId: tutorUserId }, { verificationStatus }, { new: true });
}

async function listVerifications(filter = { status: 'pending' }) {
  return TutorVerification.find(filter)
    .populate('tutorUserId', 'name phone email country')
    .sort({ submittedAt: -1, updatedAt: -1 });
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

async function findLessonPlan(id, tutorUserId) {
  return LessonPlan.findOne({ _id: id, tutorUserId })
    .populate('subjectId')
    .populate('studentUserId', 'name phone');
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
  withoutBookedOverlaps,
  searchTutors,
  getTutorDetail,
  upsertOffering,
  listOfferings,
  deleteOffering,
  findOffering,
  addAvailability,
  listAvailability,
  findSlotOverlap,
  deleteAvailability,
  markSlotBooked,
  claimSlot,
  findSlotById,
  findVerificationByTutor,
  getOrCreateVerification,
  setProfileVerification,
  listVerifications,
  upsertReview,
  recalculateRating,
  createStudentNote,
  listStudentNotes,
  deleteStudentNote,
  createLessonPlan,
  updateLessonPlan,
  findLessonPlan,
  listLessonPlans,
  deleteLessonPlan,
  createVideo,
  listVideos,
  deleteVideo,
};
