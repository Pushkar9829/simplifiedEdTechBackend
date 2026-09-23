const mongoose = require('mongoose');
const dayjs = require('../../utils/time').dayjs;
const bookingRepo = require('./booking.repo');
const SessionReport = require('./sessionReport.model');
const tutorRepo = require('../tutor/tutor.repo');
const paymentRepo = require('../payment/payment.repo');
const userRepo = require('../user/user.repo');
const parentRepo = require('../parent/parent.repo');
const homeworkRepo = require('../homework/homework.repo');
const homeworkService = require('../homework/homework.service');
const { Assignment, Submission } = require('../homework/homework.model');
const { LessonPlan } = require('../tutor/tutor.model');
const Subject = require('../subject/subject.model');
const notificationService = require('../notification/notification.service');
const zoom = require('../../integrations/zoom');
const { notifyParentsOfStudent } = require('../../utils/parentNotify');
const { sanitizeBookingItems, stripContact } = require('../../utils/tutorPrivacy');
const ApiError = require('../../common/ApiError');
const {
  BOOKING_STATUS,
  BOOKING_MIN_LEAD_HOURS,
  MEETING_STATUS,
  ROLES,
} = require('../../common/constants');

const JOIN_EARLY_MINUTES = 15;

function assertLeadTime(startAt) {
  const minStart = dayjs().add(BOOKING_MIN_LEAD_HOURS, 'hour');
  if (dayjs(startAt).isBefore(minStart)) {
    throw new ApiError(
      400,
      `Booking must be at least ${BOOKING_MIN_LEAD_HOURS} hours before the slot start`
    );
  }
}

function idOf(ref) {
  return (ref?._id || ref)?.toString();
}

function toPlain(doc) {
  return typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
}

// Only the tutor may see the Zoom host link; private notes never leave the tutor.
function shapeBooking(booking, user) {
  if (!booking) return booking;
  const row = toPlain(booking);
  const isTutor = user.role === ROLES.TUTOR && idOf(row.tutorUserId) === user.id;
  if (!isTutor && user.role !== ROLES.ADMIN && row.zoom) {
    row.zoom = { ...row.zoom, startUrl: '' };
  }
  return row;
}

function shapeReport(report, user) {
  if (!report) return report;
  if (user.role === ROLES.PARENT && report.sharedWithParent === false) return null;
  const row = toPlain(report);
  const isTutor = user.role === ROLES.TUTOR && idOf(row.tutorUserId) === user.id;
  if (!isTutor && user.role !== ROLES.ADMIN) delete row.privateNotes;
  return row;
}

function shapeBookingPage(page, user) {
  if (!page?.items) return page;
  const items = sanitizeBookingItems(page.items, user.role).map((b) => shapeBooking(b, user));
  return { ...page, items };
}

async function canManageStudentBooking(user, booking) {
  const studentId = idOf(booking.studentUserId);
  if (user.role === 'admin' || user.id === studentId) return true;
  if (user.role === ROLES.PARENT) {
    const link = await parentRepo.findLink(user.id, studentId);
    return Boolean(link);
  }
  return false;
}

async function canViewBooking(user, booking) {
  if (user.role === ROLES.TUTOR) return idOf(booking.tutorUserId) === user.id;
  return canManageStudentBooking(user, booking);
}

async function loadViewableBooking(user, id) {
  const booking = await bookingRepo.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!(await canViewBooking(user, booking))) throw new ApiError(403, 'Not allowed');
  return booking;
}

async function loadTutorBooking(tutorUserId, id) {
  const booking = await bookingRepo.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (idOf(booking.tutorUserId) !== tutorUserId) throw new ApiError(403, 'Not allowed');
  return booking;
}

async function resolveStudentId(actor, body) {
  if (actor.role === ROLES.STUDENT) return actor.id;
  if (actor.role === ROLES.PARENT) {
    const studentUserId = body.studentUserId;
    if (!studentUserId) throw new ApiError(400, 'studentUserId is required when a parent books');
    const link = await parentRepo.findLink(actor.id, studentUserId);
    if (!link) throw new ApiError(403, 'Student not linked to this parent');
    return studentUserId;
  }
  throw new ApiError(403, 'Not allowed to create bookings');
}

async function provisionMeeting(booking, subjectName) {
  try {
    const meeting = await zoom.createMeeting({
      topic: `${subjectName || 'Tutoring'} session`,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timezone: booking.timezone,
      seed: booking._id,
    });
    return meeting;
  } catch (err) {
    console.error('[zoom] createMeeting failed, falling back to demo link:', err.message);
    return zoom.demoMeeting(booking._id);
  }
}

async function createBooking(actor, body) {
  const studentUserId = await resolveStudentId(actor, body);
  const tutorProfile = await userRepo.getTutorProfile(body.tutorUserId);
  if (!tutorProfile || tutorProfile.verificationStatus !== 'approved') {
    throw new ApiError(400, 'Tutor is not available for booking');
  }

  let startAt;
  let endAt;
  let slot = null;
  const slotId = body.slotId;

  if (slotId) {
    slot = await tutorRepo.findSlotById(slotId);
    if (!slot || slot.isBooked) throw new ApiError(400, 'Slot unavailable');
    if (slot.tutorUserId.toString() !== body.tutorUserId) {
      throw new ApiError(400, 'Slot does not belong to tutor');
    }
    startAt = slot.startAt;
    endAt = slot.endAt;
  } else {
    startAt = new Date(body.startAt);
    endAt = new Date(body.endAt);
  }

  assertLeadTime(startAt);

  const deliveryMode = body.deliveryMode || slot?.deliveryMode || 'online';
  if (deliveryMode === 'offline' && tutorProfile.teachingMode === 'online') {
    throw new ApiError(400, 'Tutor does not offer offline classes');
  }
  if (deliveryMode === 'online' && tutorProfile.teachingMode === 'offline') {
    throw new ApiError(400, 'Tutor does not offer online classes');
  }

  const offering =
    (await tutorRepo.findOffering(body.tutorUserId, body.subjectId, body.level)) ||
    (await tutorRepo.findOffering(body.tutorUserId, body.subjectId));
  const offeringRate =
    offering &&
    (deliveryMode === 'offline'
      ? offering.offlineRate || offering.hourlyRate
      : offering.onlineRate || offering.hourlyRate);
  const profileRate =
    deliveryMode === 'offline'
      ? tutorProfile.hourlyRateOffline || tutorProfile.hourlyRate
      : tutorProfile.hourlyRateOnline || tutorProfile.hourlyRate;
  const hours = Math.max(0.25, (new Date(endAt) - new Date(startAt)) / 3600000);
  const rate = offeringRate || profileRate || 0;

  const overlap = await bookingRepo.findOverlap(body.tutorUserId, startAt, endAt);
  if (overlap) throw new ApiError(409, 'Tutor has a conflicting booking');

  const amount = Math.round(rate * hours * 100) / 100;
  const currency = (offeringRate && offering.currency) || tutorProfile.currency || 'USD';
  const timezone = body.timezone || slot?.timezone || 'UTC';
  const count = body.isRecurring ? Number(body.recurrenceCount || 1) : 1;
  const seriesId = count > 1 ? new mongoose.Types.ObjectId() : undefined;

  const bookings = [];
  for (let i = 0; i < count; i += 1) {
    const s = dayjs(startAt).add(i, 'week').toDate();
    const e = dayjs(endAt).add(i, 'week').toDate();
    const overlapI = await bookingRepo.findOverlap(body.tutorUserId, s, e);
    if (overlapI) continue;
    bookings.push({
      studentUserId,
      tutorUserId: body.tutorUserId,
      subjectId: body.subjectId,
      level: body.level || 'HL',
      slotId: i === 0 ? slotId : undefined,
      startAt: s,
      endAt: e,
      timezone,
      status: BOOKING_STATUS.CONFIRMED,
      meetingStatus: MEETING_STATUS.SCHEDULED,
      isRecurring: Boolean(body.isRecurring),
      recurrenceRule: {
        frequency: body.isRecurring ? 'weekly' : 'none',
        count,
      },
      seriesId,
      notes: body.notes || '',
      amount,
      currency,
      bookedByUserId: actor.id,
      deliveryMode,
    });
  }

  if (!bookings.length) throw new ApiError(409, 'No available slots for booking');

  const created = await bookingRepo.createMany(bookings);
  if (slotId) await tutorRepo.markSlotBooked(slotId, true);

  const subject = await Subject.findById(body.subjectId).select('name');
  for (let i = 0; i < created.length; i += 1) {
    const b = created[i];
    const patch = {};
    if (i > 0) patch.parentBookingId = created[0]._id;
    if (b.deliveryMode === 'online') {
      const meeting = await provisionMeeting(b, subject?.name);
      patch.zoom = meeting;
      patch.meetingUrl = meeting.joinUrl || '';
    }
    if (Object.keys(patch).length) {
      await bookingRepo.updateById(b._id, patch);
      Object.assign(b, patch);
    }
  }

  const payments = [];
  for (const b of created) {
    const payment = await paymentRepo.createPayment({
      payerUserId: studentUserId,
      beneficiaryUserId: body.tutorUserId,
      bookingId: b._id,
      amount: b.amount,
      currency: b.currency,
      method: 'manual',
      status: 'pending',
      description: 'Lesson booking payment',
    });
    payments.push(payment);
  }

  await notificationService.notifyMany([
    {
      userId: body.tutorUserId,
      title: 'New booking',
      body: 'You have a new lesson booking',
      type: 'booking',
    },
    {
      userId: studentUserId,
      title: 'Booking confirmed',
      body: 'Your lesson booking was created. Use Pay to settle payment.',
      type: 'booking',
    },
  ]);
  await notifyParentsOfStudent(
    studentUserId,
    'Class booked',
    'Your child has a new upcoming class booking.',
    'booking'
  );

  return { bookings: created.map((b) => shapeBooking(b, actor)), payments };
}

async function listBookings(user, query) {
  const filter = {};
  if (user.role === 'student') filter.studentUserId = user.id;
  if (user.role === 'tutor') filter.tutorUserId = user.id;
  if (user.role === 'parent') {
    const linked = await parentRepo.listLinkedStudentIds(user.id);
    filter.studentUserId = { $in: linked };
  }
  if (query.status) filter.status = query.status;
  if (query.meetingStatus) filter.meetingStatus = query.meetingStatus;
  if (query.studentUserId && ['admin', 'tutor'].includes(user.role)) {
    filter.studentUserId = query.studentUserId;
  }
  if (query.tutorUserId && user.role === 'admin') filter.tutorUserId = query.tutorUserId;
  if (query.from || query.to) {
    filter.startAt = {};
    if (query.from) filter.startAt.$gte = new Date(query.from);
    if (query.to) filter.startAt.$lte = new Date(query.to);
  }

  const page = await bookingRepo.list(filter, {
    page: Number(query.page) || 1,
    limit: Math.min(Number(query.limit) || 50, 500),
  });
  return shapeBookingPage(page, user);
}

async function cancelBooking(user, id) {
  const booking = await bookingRepo.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');

  const isTutor = idOf(booking.tutorUserId) === user.id;
  const isOwner = isTutor || (await canManageStudentBooking(user, booking));
  if (!isOwner) throw new ApiError(403, 'Not allowed');
  if (booking.status === BOOKING_STATUS.COMPLETED) {
    throw new ApiError(400, 'Completed bookings cannot be cancelled');
  }

  const updated = await bookingRepo.updateById(id, {
    status: BOOKING_STATUS.CANCELLED,
    meetingStatus: MEETING_STATUS.CANCELLED,
  });
  if (booking.slotId) await tutorRepo.markSlotBooked(booking.slotId, false);
  if (booking.zoom?.meetingId) {
    await zoom.deleteMeeting(booking.zoom.meetingId).catch((err) =>
      console.error('[zoom] deleteMeeting failed:', err.message)
    );
  }

  await notificationService.notifyMany([
    {
      userId: booking.studentUserId._id,
      title: 'Booking cancelled',
      body: 'A lesson was cancelled',
      type: 'booking',
    },
    {
      userId: booking.tutorUserId._id,
      title: 'Booking cancelled',
      body: 'A lesson was cancelled',
      type: 'booking',
    },
  ]);
  await notifyParentsOfStudent(
    booking.studentUserId._id,
    'Class cancelled',
    'A lesson for your child was cancelled.',
    'booking'
  );

  return shapeBooking(updated, user);
}

async function rescheduleBooking(user, id, body) {
  const booking = await bookingRepo.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');

  const isTutor = idOf(booking.tutorUserId) === user.id;
  if (!isTutor && !(await canManageStudentBooking(user, booking))) {
    throw new ApiError(403, 'Not allowed');
  }
  if (booking.status === BOOKING_STATUS.COMPLETED) {
    throw new ApiError(400, 'Completed bookings cannot be rescheduled');
  }
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    throw new ApiError(400, 'Cancelled bookings cannot be rescheduled');
  }

  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  assertLeadTime(startAt);
  const overlap = await bookingRepo.findOverlap(booking.tutorUserId._id, startAt, endAt, id);
  if (overlap) throw new ApiError(409, 'Tutor has a conflicting booking');

  const timezone = body.timezone || booking.timezone;
  const updated = await bookingRepo.updateById(id, {
    startAt,
    endAt,
    timezone,
    status: BOOKING_STATUS.RESCHEDULED,
    meetingStatus: MEETING_STATUS.SCHEDULED,
  });
  if (booking.zoom?.meetingId) {
    await zoom
      .updateMeeting(booking.zoom.meetingId, { startAt, endAt, timezone })
      .catch((err) => console.error('[zoom] updateMeeting failed:', err.message));
  }

  if (isTutor) {
    await notificationService.notify(
      booking.studentUserId._id,
      'Booking rescheduled',
      'Your tutor rescheduled a lesson',
      'booking'
    );
  } else {
    await notificationService.notify(
      booking.tutorUserId._id,
      'Booking rescheduled',
      'A student rescheduled a lesson',
      'booking'
    );
  }
  await notifyParentsOfStudent(
    booking.studentUserId._id,
    'Class rescheduled',
    'A lesson for your child was rescheduled.',
    'booking'
  );

  return shapeBooking(updated, user);
}

async function setAttendance(tutorUserId, id, attendance) {
  const booking = await loadTutorBooking(tutorUserId, id);
  const patch = { attendance };
  if (attendance === 'absent') patch.meetingStatus = MEETING_STATUS.NO_SHOW;
  else if (booking.meetingStatus === MEETING_STATUS.NO_SHOW) patch.meetingStatus = MEETING_STATUS.SCHEDULED;
  const updated = await bookingRepo.updateById(id, patch);
  if (attendance === 'absent') {
    await notifyParentsOfStudent(
      booking.studentUserId._id,
      'Attendance alert',
      'Your child was marked absent for a class.',
      'attendance',
      { bookingId: id }
    );
  }
  return updated;
}

async function setMeetingStatus(tutorUserId, id, meetingStatus) {
  const booking = await loadTutorBooking(tutorUserId, id);
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    throw new ApiError(400, 'Booking is cancelled');
  }
  const patch = { meetingStatus };
  if (meetingStatus === MEETING_STATUS.LIVE && !booking.startedAt) patch.startedAt = new Date();
  if (meetingStatus === MEETING_STATUS.NO_SHOW) patch.attendance = 'absent';
  return bookingRepo.updateById(id, patch);
}

function cleanReport(report = {}) {
  const topics = Array.isArray(report.topicsCovered)
    ? report.topicsCovered
    : String(report.topicsCovered || '')
        .split(',')
        .map((t) => t.trim());
  return {
    summary: report.summary || '',
    topicsCovered: topics.filter(Boolean),
    strengths: report.strengths || '',
    weaknesses: report.weaknesses || '',
    studentMood: report.studentMood || '',
    understandingRating: report.understandingRating || undefined,
    homeworkCompletion: report.homeworkCompletion || '',
    nextSteps: report.nextSteps || '',
    privateNotes: report.privateNotes || '',
    sharedWithParent: report.sharedWithParent !== false,
  };
}

async function upsertReport(booking, report) {
  const doc = await SessionReport.findOneAndUpdate(
    { bookingId: booking._id },
    {
      ...cleanReport(report),
      bookingId: booking._id,
      tutorUserId: idOf(booking.tutorUserId),
      studentUserId: idOf(booking.studentUserId),
      subjectId: idOf(booking.subjectId),
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
  await bookingRepo.updateById(booking._id, { sessionReportId: doc._id });
  return doc;
}

async function completeBooking(tutorUserId, id, body = {}, files = []) {
  const booking = await loadTutorBooking(tutorUserId, id);
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    throw new ApiError(400, 'Cancelled bookings cannot be completed');
  }
  if (new Date(booking.startAt) > new Date()) {
    throw new ApiError(400, 'You can complete a session only after it has started');
  }

  const patch = {
    status: BOOKING_STATUS.COMPLETED,
    meetingStatus: MEETING_STATUS.ENDED,
    completedAt: new Date(),
  };
  if (booking.attendance === 'pending') patch.attendance = 'present';
  const updated = await bookingRepo.updateById(id, patch);

  let report = null;
  if (body.report && Object.values(body.report).some((v) => (Array.isArray(v) ? v.length : v))) {
    report = await upsertReport(booking, body.report);
  }

  let assignment = null;
  if (body.assignment) {
    assignment = await homeworkService.create(
      tutorUserId,
      {
        ...body.assignment,
        studentUserId: idOf(booking.studentUserId),
        subjectId: idOf(booking.subjectId),
        level: body.assignment.level || booking.level,
        bookingId: booking._id.toString(),
      },
      files
    );
  }

  await notificationService.notify(
    idOf(booking.studentUserId),
    'Session completed',
    report?.summary ? `Summary: ${report.summary.slice(0, 120)}` : 'Your tutor marked the session as completed.',
    'booking',
    { bookingId: id }
  );
  if (report?.sharedWithParent) {
    await notifyParentsOfStudent(
      idOf(booking.studentUserId),
      'Session summary',
      report.summary ? report.summary.slice(0, 160) : 'A class summary is available.',
      'booking',
      { bookingId: id }
    );
  }

  return { booking: updated, report, assignment };
}

async function saveReport(tutorUserId, id, report) {
  const booking = await loadTutorBooking(tutorUserId, id);
  return upsertReport(booking, report);
}

async function joinBooking(user, id) {
  const booking = await bookingRepo.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const studentId = idOf(booking.studentUserId);
  const tutorId = idOf(booking.tutorUserId);
  let allowed = user.id === studentId || user.id === tutorId || user.role === 'admin';
  if (!allowed && user.role === ROLES.PARENT) {
    const link = await parentRepo.findLink(user.id, studentId);
    allowed = Boolean(link);
  }
  if (!allowed) throw new ApiError(403, 'Not allowed');
  if (booking.status === BOOKING_STATUS.CANCELLED) throw new ApiError(400, 'This class was cancelled');

  if (booking.deliveryMode === 'offline') {
    const slot = booking.slotId ? await tutorRepo.findSlotById(booking.slotId) : null;
    const profile = slot?.location ? null : await userRepo.getTutorProfile(tutorId);
    return {
      deliveryMode: 'offline',
      location: slot?.location || profile?.location || {},
      meetingUrl: '',
    };
  }

  const now = Date.now();
  const opensAt = new Date(booking.startAt).getTime() - JOIN_EARLY_MINUTES * 60000;
  const isTutor = user.id === tutorId;
  if (isTutor && now >= opensAt && booking.meetingStatus === MEETING_STATUS.SCHEDULED) {
    await bookingRepo.updateById(id, { meetingStatus: MEETING_STATUS.LIVE, startedAt: new Date() });
  }

  const joinUrl = booking.zoom?.joinUrl || booking.meetingUrl;
  return {
    deliveryMode: 'online',
    meetingUrl: isTutor ? booking.zoom?.startUrl || joinUrl : joinUrl,
    joinUrl,
    password: booking.zoom?.password || '',
    provider: booking.zoom?.provider || 'demo',
    opensAt: new Date(opensAt),
    location: null,
  };
}

async function reportsForBookings(bookingIds) {
  const reports = await SessionReport.find({ bookingId: { $in: bookingIds } });
  return new Map(reports.map((r) => [r.bookingId.toString(), r]));
}

async function bookingSummary(user, id) {
  const booking = await loadViewableBooking(user, id);
  const [report, assignments, payments, lessonPlans] = await Promise.all([
    SessionReport.findOne({ bookingId: booking._id }),
    homeworkRepo.listByBookingIds([booking._id]),
    paymentRepo.listPayments({ bookingId: booking._id }),
    LessonPlan.find({ bookingId: booking._id }).select('title status'),
  ]);
  const shaped = shapeBooking(booking, user);
  if (user.role !== ROLES.TUTOR && user.role !== ROLES.ADMIN) {
    shaped.tutorUserId = stripContact(shaped.tutorUserId);
  }
  return {
    booking: shaped,
    report: shapeReport(report, user),
    assignments,
    payment: payments.items?.[0] || null,
    lessonPlans,
  };
}

async function bookingChain(user, id) {
  const booking = await loadViewableBooking(user, id);
  const filter = booking.seriesId
    ? { seriesId: booking.seriesId }
    : {
        tutorUserId: idOf(booking.tutorUserId),
        studentUserId: idOf(booking.studentUserId),
        subjectId: idOf(booking.subjectId),
      };
  const page = await bookingRepo.list(filter, { page: 1, limit: 100 });
  const ids = page.items.map((b) => b._id);
  const [reports, assignments] = await Promise.all([
    reportsForBookings(ids),
    homeworkRepo.listByBookingIds(ids),
  ]);
  const items = page.items.map((b, index) => {
    const key = b._id.toString();
    return {
      index: index + 1,
      booking: shapeBooking(b, user),
      report: shapeReport(reports.get(key), user) || null,
      assignments: assignments.filter((a) => a.bookingId?.toString() === key),
      isCurrent: key === booking._id.toString(),
    };
  });
  return {
    seriesId: booking.seriesId || null,
    total: items.length,
    completed: items.filter((i) => i.booking.status === BOOKING_STATUS.COMPLETED).length,
    items,
  };
}

async function studentInsights(tutorUserId, studentUserId) {
  const reports = await SessionReport.find({ tutorUserId, studentUserId })
    .populate('subjectId', 'name')
    .sort({ createdAt: -1 })
    .limit(10);
  const rated = reports.filter((r) => r.understandingRating);
  const avg = rated.length
    ? Math.round((rated.reduce((s, r) => s + r.understandingRating, 0) / rated.length) * 10) / 10
    : null;
  const recentAvg = rated.slice(0, 3).length
    ? rated.slice(0, 3).reduce((s, r) => s + r.understandingRating, 0) / rated.slice(0, 3).length
    : null;
  const olderAvg = rated.slice(3).length
    ? rated.slice(3).reduce((s, r) => s + r.understandingRating, 0) / rated.slice(3).length
    : null;
  let trend = 'steady';
  if (recentAvg != null && olderAvg != null) {
    if (recentAvg - olderAvg >= 0.5) trend = 'improving';
    else if (olderAvg - recentAvg >= 0.5) trend = 'declining';
  }
  const topicCounts = {};
  reports.forEach((r) => (r.topicsCovered || []).forEach((t) => (topicCounts[t] = (topicCounts[t] || 0) + 1)));
  const assignments = await Assignment.find({ tutorUserId, studentUserId }).select('_id status');
  const submissions = await Submission.find({
    assignmentId: { $in: assignments.map((a) => a._id) },
    gradedAt: { $exists: true },
  })
    .sort({ gradedAt: -1 })
    .limit(5);
  const pendingHomework = assignments.filter((a) => a.status === 'assigned').length;

  return {
    lastReport: reports[0] || null,
    recentReports: reports,
    averageUnderstanding: avg,
    trend,
    topTopics: Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([topic, count]) => ({ topic, count })),
    recentGrades: submissions.map((s) => ({
      assignmentId: s.assignmentId,
      grade: s.grade,
      gradedAt: s.gradedAt,
    })),
    pendingHomework,
  };
}

module.exports = {
  createBooking,
  listBookings,
  cancelBooking,
  rescheduleBooking,
  setAttendance,
  setMeetingStatus,
  completeBooking,
  saveReport,
  joinBooking,
  bookingSummary,
  bookingChain,
  studentInsights,
};
