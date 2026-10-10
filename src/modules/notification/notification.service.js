const notificationRepo = require('./notification.repo');
const Notification = require('./notification.model');
const ApiError = require('../../common/ApiError');
const { BOOKING_STATUS, ASSIGNMENT_STATUS, PAYMENT_STATUS } = require('../../common/constants');

async function notify(userId, title, body, type = 'system', meta = {}) {
  return notificationRepo.create({ userId, title, body, type, meta });
}

async function notifyMany(entries) {
  return notificationRepo.createMany(entries);
}

// Dedupe per item (bookingId / assignmentId / paymentId) so each one gets its own alert.
async function once(userId, title, body, type, meta, hours = 24 * 7) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const [key, value] = Object.entries(meta).find(([k]) => k !== 'studentUserId') || [];
  const filter = { userId, title, type, createdAt: { $gte: since } };
  if (key) filter[`meta.${key}`] = value;
  const exists = await Notification.findOne(filter);
  if (exists) return null;
  return notify(userId, title, body, type, meta);
}

async function emitDueAlerts(userId, role) {
  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  try {
    const Booking = require('../booking/booking.model');
    const { Assignment } = require('../homework/homework.model');
    const { Payment } = require('../payment/payment.model');

    let studentIds = [userId];
    if (role === 'parent') {
      const parentRepo = require('../parent/parent.repo');
      studentIds = await parentRepo.listLinkedStudentIds(userId);
    }
    const childMeta = (studentUserId) =>
      role === 'parent' ? { studentUserId: String(studentUserId) } : {};

    const bookingWho =
      role === 'parent'
        ? { studentUserId: { $in: studentIds } }
        : { $or: [{ studentUserId: userId }, { tutorUserId: userId }] };
    const bookings = await Booking.find({
      ...bookingWho,
      status: {
        $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING, BOOKING_STATUS.RESCHEDULED],
      },
      startAt: { $gte: now, $lte: soon },
    }).populate('subjectId', 'name');
    for (const b of bookings) {
      const when = new Date(b.startAt).toLocaleString();
      await once(
        userId,
        'Class coming up',
        `${b.subjectId?.name || 'Class'} starts ${when}.`,
        'booking',
        { bookingId: b._id, ...childMeta(b.studentUserId) }
      );
    }

    if (studentIds.length && role !== 'tutor') {
      const homework = await Assignment.find({
        studentUserId: { $in: studentIds },
        status: ASSIGNMENT_STATUS.ASSIGNED,
        deadline: { $gte: now, $lte: soon },
      });
      for (const h of homework) {
        await once(
          userId,
          'Homework due soon',
          `${h.title} is due ${new Date(h.deadline).toLocaleString()}.`,
          'homework',
          { assignmentId: h._id, ...childMeta(h.studentUserId) }
        );
      }
    }

    if (role === 'tutor') {
      const toGrade = await Assignment.find({
        tutorUserId: userId,
        status: ASSIGNMENT_STATUS.SUBMITTED,
      })
        .sort({ updatedAt: -1 })
        .limit(20);
      for (const h of toGrade) {
        await once(
          userId,
          'Homework to grade',
          `${h.title} has been submitted and is waiting for grading.`,
          'homework',
          { assignmentId: h._id }
        );
      }
    }

    const dues = await Payment.find({
      payerUserId: userId,
      status: PAYMENT_STATUS.PENDING,
    }).limit(10);
    for (const p of dues) {
      await once(
        userId,
        'Payment due',
        `${p.description || 'An invoice'} is waiting to be paid.`,
        'payment',
        { paymentId: p._id }
      );
    }
  } catch {
    /* alerts are best-effort */
  }
}

const ALERT_INTERVAL_MS = 10 * 60 * 1000;
const lastAlertRun = new Map();

// Polling callers (unread badge) re-run due alerts at most every few minutes per user.
async function emitDueAlertsThrottled(userId, role) {
  const key = String(userId);
  const last = lastAlertRun.get(key) || 0;
  if (Date.now() - last < ALERT_INTERVAL_MS) return;
  lastAlertRun.set(key, Date.now());
  if (lastAlertRun.size > 5000) lastAlertRun.clear();
  await emitDueAlerts(userId, role);
}

async function list(userId, query, role) {
  await emitDueAlerts(userId, role);
  lastAlertRun.set(String(userId), Date.now());
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const [data, unread] = await Promise.all([
    notificationRepo.listByUser(userId, { page, limit }),
    notificationRepo.countUnread(userId),
  ]);
  return { ...data, unread };
}

async function unreadCount(userId, role) {
  await emitDueAlertsThrottled(userId, role);
  return { unread: await notificationRepo.countUnread(userId) };
}

async function markRead(id, userId) {
  const item = await notificationRepo.markRead(id, userId);
  if (!item) throw new ApiError(404, 'Notification not found');
  return item;
}

async function markAllRead(userId) {
  return notificationRepo.markAllRead(userId);
}

module.exports = { notify, notifyMany, list, unreadCount, markRead, markAllRead };
