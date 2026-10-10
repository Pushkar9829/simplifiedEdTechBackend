const ScheduleChange = require('./scheduleChange.model');
const bookingRepo = require('./booking.repo');
const paymentRepo = require('../payment/payment.repo');
const userRepo = require('../user/user.repo');
const zoom = require('../../integrations/zoom');
const tutorRepo = require('../tutor/tutor.repo');
const notificationService = require('../notification/notification.service');
const { notifyParentsOfStudent } = require('../../utils/parentNotify');
const ApiError = require('../../common/ApiError');
const { dayjs } = require('../../utils/time');
const {
  BOOKING_STATUS,
  MEETING_STATUS,
  CANCEL_NOTICE_HOURS,
  STUDENT_RESCHEDULES_PER_MONTH,
  ROLES,
  BOOKING_MIN_LEAD_HOURS,
} = require('../../common/constants');

const OPEN_CHANGE_STATUSES = ['pending', 'slots_offered', 'awaiting_replacement', 'awaiting_approval'];

function idOf(ref) {
  return (ref?._id || ref)?.toString();
}

function assertChangeable(booking) {
  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED].includes(booking.status)) {
    throw new ApiError(400, 'This class can no longer be changed');
  }
}

// A cancelled or completed class must not be revived by a stale reschedule request.
async function closeOpenChanges(bookingId) {
  return ScheduleChange.updateMany(
    { bookingId, status: { $in: OPEN_CHANGE_STATUSES } },
    { status: 'declined' }
  );
}

function noticeHours(startAt) {
  return (new Date(startAt).getTime() - Date.now()) / 3600000;
}

async function canManageStudent(user, booking) {
  const studentId = idOf(booking.studentUserId);
  if (user.role === ROLES.ADMIN || user.id === studentId) return true;
  if (user.role === ROLES.PARENT) {
    const parentRepo = require('../parent/parent.repo');
    return Boolean(await parentRepo.findLink(user.id, studentId));
  }
  return false;
}

async function assertParty(user, booking) {
  const isTutor = idOf(booking.tutorUserId) === user.id;
  if (isTutor || (await canManageStudent(user, booking))) return isTutor;
  throw new ApiError(403, 'Not allowed');
}

async function freeSlots(tutorUserId, deliveryMode) {
  const AvailabilitySlot = require('../tutor/tutor.model').AvailabilitySlot;
  const q = { tutorUserId, isBooked: false, startAt: { $gte: new Date() } };
  if (deliveryMode) q.deliveryMode = deliveryMode;
  const slots = await AvailabilitySlot.find(q).sort({ startAt: 1 }).limit(60);
  return (await tutorRepo.withoutBookedOverlaps(tutorUserId, slots)).slice(0, 40);
}

async function studentMonthlyCount(studentUserId, cycle) {
  return ScheduleChange.countDocuments({
    studentUserId,
    cycle,
    countsAgainstMonthly: true,
    status: { $in: ['pending', 'slots_offered', 'awaiting_replacement', 'awaiting_approval', 'confirmed'] },
  });
}

async function entitlement(user, studentUserId) {
  const sid = studentUserId || user.id;
  if (user.role === ROLES.PARENT && sid !== user.id) {
    const parentRepo = require('../parent/parent.repo');
    if (!(await parentRepo.findLink(user.id, sid))) throw new ApiError(403, 'Student not linked');
  }
  const cycle = dayjs().format('YYYY-MM');
  const used = await studentMonthlyCount(sid, cycle);
  return {
    cycle,
    used,
    limit: STUDENT_RESCHEDULES_PER_MONTH,
    remaining: Math.max(0, STUDENT_RESCHEDULES_PER_MONTH - used),
    noticeHours: CANCEL_NOTICE_HOURS,
  };
}

async function openChange(bookingId) {
  return ScheduleChange.findOne({
    bookingId,
    status: { $in: OPEN_CHANGE_STATUSES },
  })
    .populate('offeredSlotIds')
    .populate('replacementTutorUserId', 'name refCode');
}

async function requestReschedule(user, bookingId, body = {}) {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const isTutor = await assertParty(user, booking);
  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED].includes(booking.status)) {
    throw new ApiError(400, 'This class cannot be rescheduled');
  }
  const existing = await openChange(bookingId);
  if (existing) {
    const suggested = existing.offeredSlotIds?.length
      ? existing.offeredSlotIds
      : await freeSlots(idOf(booking.tutorUserId), booking.deliveryMode);
    return {
      change: existing,
      slots: existing.status === 'slots_offered' ? suggested : [],
      suggestedSlots: suggested,
      entitlement: await entitlement(user, idOf(booking.studentUserId)),
    };
  }

  const hours = noticeHours(booking.startAt);
  const cycle = dayjs().format('YYYY-MM');
  const studentId = idOf(booking.studentUserId);
  const countsAgainstMonthly = !isTutor && user.role !== ROLES.ADMIN;
  if (countsAgainstMonthly) {
    const used = await studentMonthlyCount(studentId, cycle);
    if (used >= STUDENT_RESCHEDULES_PER_MONTH) {
      throw new ApiError(
        400,
        'You have used this month’s one student-initiated reschedule. Tutor-initiated changes do not use this limit.'
      );
    }
  }

  let slots = await freeSlots(idOf(booking.tutorUserId), booking.deliveryMode);
  // A tutor may offer a chosen subset; otherwise every free slot is offered.
  if (isTutor && Array.isArray(body.slotIds) && body.slotIds.length) {
    const chosen = new Set(body.slotIds.map(String));
    slots = slots.filter((s) => chosen.has(String(s._id)));
    if (slots.length !== chosen.size) throw new ApiError(400, 'A selected slot is no longer free');
  }
  const tutorOffering = isTutor;
  const change = await ScheduleChange.create({
    bookingId,
    studentUserId: studentId,
    tutorUserId: idOf(booking.tutorUserId),
    initiatedByUserId: user.id,
    initiatedByRole: isTutor ? 'tutor' : user.role,
    kind: 'reschedule',
    status: tutorOffering ? (slots.length ? 'slots_offered' : 'awaiting_replacement') : 'pending',
    reason: body.reason || '',
    noticeHours: Math.round(hours * 10) / 10,
    late: hours < CANCEL_NOTICE_HOURS,
    countsAgainstMonthly,
    cycle,
    offeredSlotIds: tutorOffering ? slots.map((s) => s._id) : [],
  });

  await notificationService.notify(
    isTutor ? studentId : idOf(booking.tutorUserId),
    'Reschedule request',
    isTutor
      ? slots.length
        ? 'Your tutor offered new times. Select a slot in the Scholaris app.'
        : 'Your tutor has no free slot. You may request a replacement tutor at no extra charge.'
      : 'A student asked to reschedule. Confirm your available slots in the Scholaris app.',
    'booking',
    { bookingId, changeId: change._id }
  );
  return {
    change,
    slots: tutorOffering ? slots : [],
    suggestedSlots: slots,
    entitlement: await entitlement(user, studentId),
  };
}

async function offerSlots(user, bookingId, slotIds = [], reason) {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const isTutor = await assertParty(user, booking);
  if (!isTutor && user.role !== ROLES.ADMIN) throw new ApiError(403, 'Only the assigned tutor can offer slots');
  const ids = (Array.isArray(slotIds) ? slotIds : []).filter(Boolean);
  let change = await openChange(bookingId);
  if (!change) {
    const created = await requestReschedule(user, bookingId, { slotIds: ids, reason });
    if (ids.length) return { change: created.change, slots: created.slots };
    change = created.change;
  }
  if (!ids.length) {
    change.status = 'awaiting_replacement';
    change.offeredSlotIds = [];
    await change.save();
    await notificationService.notify(
      idOf(booking.studentUserId),
      'No alternative slot',
      'Your tutor has no free slot. You may keep the original time or request a replacement tutor at no extra charge.',
      'booking',
      { bookingId }
    );
    return { change, slots: [] };
  }
  for (const slotId of ids) {
    const slot = await tutorRepo.findSlotById(slotId);
    if (!slot || slot.isBooked) throw new ApiError(400, 'A selected slot is no longer free');
    if (slot.tutorUserId.toString() !== idOf(booking.tutorUserId)) {
      throw new ApiError(400, 'Slot does not belong to the assigned tutor');
    }
    if (!(await tutorRepo.withoutBookedOverlaps(idOf(booking.tutorUserId), [slot])).length) {
      throw new ApiError(409, 'A selected slot clashes with another booking');
    }
  }
  change.offeredSlotIds = ids;
  change.status = 'slots_offered';
  if (reason) change.reason = String(reason).slice(0, 500);
  await change.save();
  await notificationService.notify(
    idOf(booking.studentUserId),
    'Slots offered',
    'Your tutor confirmed available times. Select a slot in the Scholaris app.',
    'booking',
    { bookingId }
  );
  return { change, slots: await freeSlots(idOf(booking.tutorUserId), booking.deliveryMode) };
}

async function selectSlot(user, bookingId, slotId) {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const isTutor = await assertParty(user, booking);
  if (isTutor) throw new ApiError(400, 'The student or parent must confirm the new slot in the app');
  assertChangeable(booking);
  let change = await openChange(bookingId);
  if (!change || change.status !== 'slots_offered') {
    throw new ApiError(400, 'Wait for the tutor to confirm available slots, then pick one');
  }
  const offered = (change.offeredSlotIds || []).map((s) => String(s._id || s));
  if (offered.length && !offered.includes(String(slotId))) {
    throw new ApiError(400, 'That slot was not offered by the tutor');
  }
  const slot = await tutorRepo.findSlotById(slotId);
  if (!slot || slot.isBooked) throw new ApiError(400, 'That slot is no longer available');
  if (slot.tutorUserId.toString() !== idOf(booking.tutorUserId)) {
    throw new ApiError(400, 'Slot does not belong to the assigned tutor');
  }
  if (noticeHours(slot.startAt) < BOOKING_MIN_LEAD_HOURS) {
    throw new ApiError(400, `Pick a slot at least ${BOOKING_MIN_LEAD_HOURS} hours from now`);
  }
  if (slot.deliveryMode && slot.deliveryMode !== booking.deliveryMode) {
    throw new ApiError(400, `This slot is for ${slot.deliveryMode} classes`);
  }
  const overlap = await bookingRepo.findOverlap(idOf(booking.tutorUserId), slot.startAt, slot.endAt, bookingId);
  if (overlap) throw new ApiError(409, 'Tutor has a conflicting booking');
  if (!(await tutorRepo.claimSlot(slotId))) throw new ApiError(409, 'That slot is no longer available');

  if (booking.slotId) await tutorRepo.markSlotBooked(booking.slotId, false);
  const updated = await bookingRepo.updateById(bookingId, {
    $set: {
      slotId,
      startAt: slot.startAt,
      endAt: slot.endAt,
      timezone: slot.timezone || booking.timezone,
      status: BOOKING_STATUS.RESCHEDULED,
      meetingStatus: MEETING_STATUS.SCHEDULED,
    },
    $unset: { doorstep: 1 },
  });
  if (booking.zoom?.meetingId) {
    await zoom
      .updateMeeting(booking.zoom.meetingId, { startAt: slot.startAt, endAt: slot.endAt, timezone: updated.timezone })
      .catch((err) => console.error('[zoom] updateMeeting failed:', err.message));
  }
  change.status = 'confirmed';
  change.selectedSlotId = slotId;
  await change.save();

  await notificationService.notifyMany([
    { userId: idOf(booking.studentUserId), title: 'Class rescheduled', body: 'The new time is confirmed in the Scholaris app.', type: 'booking' },
    { userId: idOf(booking.tutorUserId), title: 'Class rescheduled', body: 'The new time is confirmed in the Scholaris app.', type: 'booking' },
  ]);
  return { booking: updated, change };
}

async function assertReplacementTutor(booking, tutorUserId) {
  const profile = await userRepo.getTutorProfile(tutorUserId);
  if (!profile || profile.verificationStatus !== 'approved') {
    throw new ApiError(400, 'Replacement tutor is not available for booking');
  }
  const mode = profile.teachingMode || 'online';
  if (mode !== 'both' && mode !== booking.deliveryMode) {
    throw new ApiError(400, `Replacement tutor does not teach ${booking.deliveryMode} classes`);
  }
  const userService = require('../user/user.service');
  if (await userService.isBlocked(idOf(booking.studentUserId), tutorUserId)) {
    throw new ApiError(403, 'This tutor or student is blocked');
  }
  const overlap = await bookingRepo.findOverlap(tutorUserId, booking.startAt, booking.endAt, booking._id);
  if (overlap) throw new ApiError(409, 'Replacement tutor has a conflicting booking');
}

async function proposeReplacement(user, bookingId, tutorUserId) {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (!(await canManageStudent(user, booking))) throw new ApiError(403, 'Not allowed');
  assertChangeable(booking);
  if (!/^[a-f0-9]{24}$/i.test(String(tutorUserId || ''))) {
    throw new ApiError(400, 'tutorUserId is required');
  }
  if (String(tutorUserId) === idOf(booking.tutorUserId)) {
    throw new ApiError(400, 'Pick a different tutor');
  }
  await assertReplacementTutor(booking, tutorUserId);
  let change = await openChange(bookingId);
  if (!change) {
    const created = await requestReschedule(user, bookingId, {});
    change = created.change;
  }
  change.replacementTutorUserId = tutorUserId;
  change.status = 'awaiting_approval';
  await change.save();
  await notificationService.notify(
    tutorUserId,
    'Replacement class request',
    'A student asked to move a paid class to you. Approve it in Bookings. No extra payment.',
    'booking',
    { bookingId, changeId: change._id }
  );
  return change;
}

async function approveReplacement(user, bookingId) {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const change = await openChange(bookingId);
  if (!change?.replacementTutorUserId) throw new ApiError(400, 'No replacement tutor is waiting');
  if (user.id !== idOf(change.replacementTutorUserId) && user.role !== ROLES.ADMIN) {
    throw new ApiError(403, 'Only the proposed tutor can approve');
  }
  assertChangeable(booking);
  const newTutorId = idOf(change.replacementTutorUserId);
  await assertReplacementTutor(booking, newTutorId);
  if (booking.slotId) await tutorRepo.markSlotBooked(booking.slotId, false);
  const updated = await bookingRepo.updateById(bookingId, {
    $set: {
      tutorUserId: newTutorId,
      status: BOOKING_STATUS.RESCHEDULED,
      meetingStatus: MEETING_STATUS.SCHEDULED,
    },
    $unset: { slotId: 1, doorstep: 1 },
  });
  await paymentRepo.reassignBookingBeneficiary(bookingId, newTutorId);
  change.status = 'confirmed';
  change.tutorUserId = newTutorId;
  await change.save();
  await notificationService.notify(
    idOf(booking.studentUserId),
    'Replacement tutor confirmed',
    'Your class moved to the new tutor. No extra payment.',
    'booking',
    { bookingId }
  );
  return { booking: updated, change };
}

async function declineChange(user, bookingId) {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const change = await openChange(bookingId);
  if (!change) throw new ApiError(404, 'No open request');
  const isReplacement = user.id === String(change.replacementTutorUserId?._id || change.replacementTutorUserId);
  if (!isReplacement) await assertParty(user, booking);
  change.status = 'declined';
  await change.save();
  return { change, booking, message: 'The original class time stays in place.' };
}

async function policyCancel(user, bookingId, body = {}) {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found');
  const isTutor = await assertParty(user, booking);
  if (booking.status === BOOKING_STATUS.COMPLETED) {
    throw new ApiError(400, 'Completed bookings cannot be cancelled');
  }
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    throw new ApiError(400, 'This class is already cancelled');
  }

  const hours = noticeHours(booking.startAt);
  const isAdmin = user.role === ROLES.ADMIN;
  // Late-cancel penalty applies to the student side only; admins and tutors cancel cleanly.
  const late = !isTutor && !isAdmin && hours < CANCEL_NOTICE_HOURS;
  // A no-show can only be recorded by the tutor/admin once the class has started.
  const noShow = Boolean(body.noShow) && (isTutor || isAdmin) && hours <= 0;
  const consumed = late || noShow;
  const patch = {
    status: consumed ? BOOKING_STATUS.COMPLETED : BOOKING_STATUS.CANCELLED,
    meetingStatus: consumed ? MEETING_STATUS.NO_SHOW : MEETING_STATUS.CANCELLED,
    attendance: consumed ? 'absent' : booking.attendance,
    consumed,
    consumedReason: consumed
      ? noShow
        ? 'no_show'
        : 'late_cancel'
      : isTutor
        ? 'tutor_cancel'
        : 'on_time_cancel',
    completedAt: consumed ? new Date() : undefined,
  };
  const updated = await bookingRepo.updateById(bookingId, patch);
  await closeOpenChanges(bookingId);
  if (!consumed) {
    if (booking.slotId) await tutorRepo.markSlotBooked(booking.slotId, false);
    await paymentRepo.voidBookingPayments(bookingId);
    if (booking.zoom?.meetingId) {
      await zoom
        .deleteMeeting(booking.zoom.meetingId)
        .catch((err) => console.error('[zoom] deleteMeeting failed:', err.message));
    }
  }

  const cycle = dayjs().format('YYYY-MM');
  await ScheduleChange.create({
    bookingId,
    studentUserId: idOf(booking.studentUserId),
    tutorUserId: idOf(booking.tutorUserId),
    initiatedByUserId: user.id,
    initiatedByRole: isTutor ? 'tutor' : user.role,
    kind: 'cancel',
    status: consumed ? 'consumed' : 'confirmed',
    reason: body.reason || '',
    noticeHours: Math.round(hours * 10) / 10,
    late,
    countsAgainstMonthly: false,
    cycle,
  });

  const bodyText = consumed
    ? 'This class was a late cancellation or no-show and counts as consumed under the Scholaris policy.'
    : isTutor
      ? 'Your tutor cancelled. This does not use your monthly reschedule. An alternative can be arranged in the app.'
      : 'The class was cancelled with notice. You may reschedule another class if entitlement remains.';
  const when = dayjs(booking.startAt).tz(booking.timezone || 'UTC').format('D MMM, HH:mm');
  const subjectName = booking.subjectId?.name || 'Class';
  // The tutor gets their own wording; the student-side text talks about the student's entitlement.
  const tutorText = consumed
    ? `${subjectName} on ${when} was a late cancellation or no-show and counts as consumed.`
    : isTutor
      ? `You cancelled ${subjectName} on ${when}. The student has been notified.`
      : `${subjectName} on ${when} was cancelled by the student with notice. The slot is free again.`;
  await notificationService.notifyMany([
    { userId: idOf(booking.studentUserId), title: 'Class cancelled', body: bodyText, type: 'booking', meta: { bookingId } },
    { userId: idOf(booking.tutorUserId), title: 'Class cancelled', body: tutorText, type: 'booking', meta: { bookingId } },
  ]);
  await notifyParentsOfStudent(idOf(booking.studentUserId), 'Class cancelled', bodyText, 'booking');
  return {
    booking: updated,
    policy: {
      late,
      consumed,
      noticeHours: Math.round(hours * 10) / 10,
      requiredNoticeHours: CANCEL_NOTICE_HOURS,
      tutorInitiated: isTutor,
    },
  };
}

async function listMine(user) {
  const filter = {};
  if (user.role === ROLES.TUTOR) {
    filter.$or = [{ tutorUserId: user.id }, { replacementTutorUserId: user.id }];
  }
  else if (user.role === ROLES.STUDENT) filter.studentUserId = user.id;
  else if (user.role === ROLES.PARENT) {
    const parentRepo = require('../parent/parent.repo');
    const ids = await parentRepo.listLinkedStudentIds(user.id);
    filter.studentUserId = { $in: ids };
  }
  const rows = await ScheduleChange.find(filter)
    .populate({ path: 'bookingId', select: 'startAt subjectId status deliveryMode', populate: { path: 'subjectId', select: 'name' } })
    .populate('tutorUserId', 'name refCode')
    .populate('studentUserId', 'name')
    .populate('replacementTutorUserId', 'name refCode')
    .populate('offeredSlotIds')
    .sort({ createdAt: -1 })
    .limit(50);
  if (user.role !== ROLES.STUDENT && user.role !== ROLES.PARENT) return rows;
  const { stripContact } = require('../../utils/tutorPrivacy');
  return rows.map((row) => {
    const next = typeof row.toObject === 'function' ? row.toObject() : { ...row };
    if (next.tutorUserId) next.tutorUserId = stripContact(next.tutorUserId);
    if (next.replacementTutorUserId) next.replacementTutorUserId = stripContact(next.replacementTutorUserId);
    return next;
  });
}

module.exports = {
  entitlement,
  requestReschedule,
  offerSlots,
  selectSlot,
  proposeReplacement,
  approveReplacement,
  declineChange,
  policyCancel,
  listMine,
  openChange,
  closeOpenChanges,
  freeSlots,
};
