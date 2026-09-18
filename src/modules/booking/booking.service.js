const dayjs = require('../../utils/time').dayjs;
const bookingRepo = require('./booking.repo');
const tutorRepo = require('../tutor/tutor.repo');
const paymentRepo = require('../payment/payment.repo');
const userRepo = require('../user/user.repo');
const parentRepo = require('../parent/parent.repo');
const notificationService = require('../notification/notification.service');
const { notifyParentsOfStudent } = require('../../utils/parentNotify');
const { sanitizeBookingItems } = require('../../utils/tutorPrivacy');
const ApiError = require('../../common/ApiError');
const { BOOKING_STATUS, BOOKING_MIN_LEAD_HOURS, ROLES } = require('../../common/constants');

function assertLeadTime(startAt) {
  const minStart = dayjs().add(BOOKING_MIN_LEAD_HOURS, 'hour');
  if (dayjs(startAt).isBefore(minStart)) {
    throw new ApiError(
      400,
      `Booking must be at least ${BOOKING_MIN_LEAD_HOURS} hours before the slot start`
    );
  }
}

function meetingUrlFor(bookingId) {
  return `https://zoom.us/j/${String(bookingId).replace(/[^a-zA-Z0-9]/g, '').slice(-11) || 'ibdp'}`;
}

function sanitizeBookingPage(page, role) {
  if (!page?.items) return page;
  return { ...page, items: sanitizeBookingItems(page.items, role) };
}

async function canManageStudentBooking(user, booking) {
  const studentId = booking.studentUserId._id.toString();
  if (user.role === 'admin' || user.id === studentId) return true;
  if (user.role === ROLES.PARENT) {
    const link = await parentRepo.findLink(user.id, studentId);
    return Boolean(link);
  }
  return false;
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

async function createBooking(actor, body) {
  const studentUserId = await resolveStudentId(actor, body);
  const tutorProfile = await userRepo.getTutorProfile(body.tutorUserId);
  if (!tutorProfile || tutorProfile.verificationStatus !== 'approved') {
    throw new ApiError(400, 'Tutor is not available for booking');
  }

  let startAt;
  let endAt;
  let slotId = body.slotId;

  if (slotId) {
    const slot = await tutorRepo.findSlotById(slotId);
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

  const deliveryMode =
    body.deliveryMode ||
    (slotId && (await tutorRepo.findSlotById(slotId))?.deliveryMode) ||
    'online';
  if (deliveryMode === 'offline' && tutorProfile.teachingMode === 'online') {
    throw new ApiError(400, 'Tutor does not offer offline classes');
  }
  if (deliveryMode === 'online' && tutorProfile.teachingMode === 'offline') {
    throw new ApiError(400, 'Tutor does not offer online classes');
  }

  const rate =
    deliveryMode === 'offline'
      ? tutorProfile.hourlyRateOffline || tutorProfile.hourlyRate
      : tutorProfile.hourlyRateOnline || tutorProfile.hourlyRate;

  const overlap = await bookingRepo.findOverlap(body.tutorUserId, startAt, endAt);
  if (overlap) throw new ApiError(409, 'Tutor has a conflicting booking');

  const amount = body.amount ?? rate ?? 0;
  const currency = tutorProfile.currency || 'USD';
  const timezone = body.timezone || 'UTC';
  const count = body.isRecurring ? Number(body.recurrenceCount || 1) : 1;

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
      isRecurring: Boolean(body.isRecurring),
      recurrenceRule: {
        frequency: body.isRecurring ? 'weekly' : 'none',
        count,
      },
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

  for (const b of created) {
    if (b.deliveryMode === 'online') {
      await bookingRepo.updateById(b._id, { meetingUrl: meetingUrlFor(b._id) });
      b.meetingUrl = meetingUrlFor(b._id);
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

  return { bookings: created, payments };
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
  if (query.studentUserId && user.role === 'admin') filter.studentUserId = query.studentUserId;
  if (query.tutorUserId && user.role === 'admin') filter.tutorUserId = query.tutorUserId;

  const page = await bookingRepo.list(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
  return sanitizeBookingPage(page, user.role);
}

async function cancelBooking(user, id) {
  const booking = await bookingRepo.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');

  const isTutor = booking.tutorUserId._id.toString() === user.id;
  const isOwner = isTutor || (await canManageStudentBooking(user, booking));
  if (!isOwner) throw new ApiError(403, 'Not allowed');

  const updated = await bookingRepo.updateById(id, { status: BOOKING_STATUS.CANCELLED });
  if (booking.slotId) await tutorRepo.markSlotBooked(booking.slotId, false);

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

  return updated;
}

async function rescheduleBooking(user, id, body) {
  const booking = await bookingRepo.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!(await canManageStudentBooking(user, booking))) {
    throw new ApiError(403, 'Not allowed');
  }

  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  assertLeadTime(startAt);
  const overlap = await bookingRepo.findOverlap(booking.tutorUserId._id, startAt, endAt, id);
  if (overlap) throw new ApiError(409, 'Tutor has a conflicting booking');

  const updated = await bookingRepo.updateById(id, {
    startAt,
    endAt,
    timezone: body.timezone || booking.timezone,
    status: BOOKING_STATUS.RESCHEDULED,
  });

  await notificationService.notify(
    booking.tutorUserId._id,
    'Booking rescheduled',
    'A student rescheduled a lesson',
    'booking'
  );
  await notifyParentsOfStudent(
    booking.studentUserId._id,
    'Class rescheduled',
    'A lesson for your child was rescheduled.',
    'booking'
  );

  return updated;
}

async function setAttendance(tutorUserId, id, attendance) {
  const booking = await bookingRepo.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.tutorUserId._id.toString() !== tutorUserId) throw new ApiError(403, 'Not allowed');
  const updated = await bookingRepo.updateById(id, { attendance });
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

async function completeBooking(tutorUserId, id) {
  const booking = await bookingRepo.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.tutorUserId._id.toString() !== tutorUserId) throw new ApiError(403, 'Not allowed');
  return bookingRepo.updateById(id, { status: BOOKING_STATUS.COMPLETED });
}

async function joinBooking(user, id) {
  const booking = await bookingRepo.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const studentId = booking.studentUserId._id.toString();
  const tutorId = booking.tutorUserId._id.toString();
  let allowed =
    user.id === studentId || user.id === tutorId || user.role === 'admin';
  if (!allowed && user.role === ROLES.PARENT) {
    const link = await parentRepo.findLink(user.id, studentId);
    allowed = Boolean(link);
  }
  if (!allowed) throw new ApiError(403, 'Not allowed');

  if (booking.deliveryMode === 'offline') {
    const profile = await userRepo.getTutorProfile(tutorId);
    return {
      deliveryMode: 'offline',
      location: profile?.location || {},
      meetingUrl: '',
    };
  }
  return {
    deliveryMode: 'online',
    meetingUrl: booking.meetingUrl || meetingUrlFor(booking._id),
    location: null,
  };
}

module.exports = {
  createBooking,
  listBookings,
  cancelBooking,
  rescheduleBooking,
  setAttendance,
  completeBooking,
  joinBooking,
};
