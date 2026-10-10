const parentRepo = require('./parent.repo');
const userRepo = require('../user/user.repo');
const bookingRepo = require('../booking/booking.repo');
const Booking = require('../booking/booking.model');
const homeworkRepo = require('../homework/homework.repo');
const paymentRepo = require('../payment/payment.repo');
const progressService = require('../progress/progress.service');
const ApiError = require('../../common/ApiError');
const { BOOKING_STATUS } = require('../../common/constants');
const { sanitizeBookingItems } = require('../../utils/tutorPrivacy');

async function linkStudent(parentUserId, studentPhone, relationship) {
  const student = await userRepo.findByPhone(studentPhone);
  if (!student || student.role !== 'student') {
    throw new ApiError(404, 'Student not found for this phone');
  }
  return parentRepo.link({
    parentUserId,
    studentUserId: student._id,
    relationship: relationship || 'parent',
    status: 'active',
  });
}

async function myChildren(parentUserId) {
  return parentRepo.listLinks(parentUserId);
}

async function dashboard(parentUserId, studentUserId) {
  const link = await parentRepo.findLink(parentUserId, studentUserId);
  if (!link) throw new ApiError(403, 'Student not linked to this parent');
  await link.populate('studentUserId', 'name role refCode avatar');

  const now = new Date();
  const childBookingIds = await Booking.distinct('_id', { studentUserId });
  const [upcomingPage, pastClasses, bookingStats, homeworkPage, paymentsPage, progress, profile] =
    await Promise.all([
      bookingRepo.list(
        { studentUserId, startAt: { $gte: now }, status: { $ne: BOOKING_STATUS.CANCELLED } },
        { page: 1, limit: 8 }
      ),
      Booking.find({ studentUserId, startAt: { $lt: now } })
        .populate('subjectId')
        .populate('studentUserId', 'name role timezone country')
        .populate('tutorUserId', 'name role timezone country refCode')
        .populate('bookedByUserId', 'name role phone')
        .sort({ startAt: -1 })
        .limit(6),
      Booking.find({ studentUserId }).select('status attendance').lean(),
      homeworkRepo.listAssignments({ studentUserId }, { page: 1, limit: 50 }),
      paymentRepo.listPayments(
        {
          $or: [
            { payerUserId: studentUserId },
            { payerUserId: parentUserId, bookingId: { $in: childBookingIds } },
          ],
        },
        { page: 1, limit: 50 }
      ),
      progressService.myProgress(studentUserId),
      userRepo.getStudentProfile(studentUserId),
    ]);

  const bookings = bookingStats;
  const homework = homeworkPage.items || [];
  const payments = paymentsPage.items || [];
  const upcomingClasses = upcomingPage.items || [];

  const attendance = { present: 0, absent: 0, pending: 0 };
  bookings.forEach((b) => {
    const key = b.attendance || 'pending';
    attendance[key] = (attendance[key] || 0) + 1;
  });

  const homeworkByStatus = {};
  homework.forEach((h) => {
    homeworkByStatus[h.status] = (homeworkByStatus[h.status] || 0) + 1;
  });

  const paymentsByStatus = {};
  let paidTotal = 0;
  let pendingTotal = 0;
  // Amounts in different currencies cannot be added; the UI renders one figure per currency.
  const paidByCurrency = {};
  const pendingByCurrency = {};
  payments.forEach((p) => {
    paymentsByStatus[p.status] = (paymentsByStatus[p.status] || 0) + 1;
    const cur = p.currency || 'USD';
    if (p.status === 'paid') {
      paidTotal += p.amount || 0;
      paidByCurrency[cur] = Math.round(((paidByCurrency[cur] || 0) + (p.amount || 0)) * 100) / 100;
    }
    if (['pending', 'failed'].includes(p.status)) {
      pendingTotal += p.amount || 0;
      pendingByCurrency[cur] = Math.round(((pendingByCurrency[cur] || 0) + (p.amount || 0)) * 100) / 100;
    }
  });

  const bookingByStatus = {};
  bookings.forEach((b) => {
    bookingByStatus[b.status] = (bookingByStatus[b.status] || 0) + 1;
  });

  return {
    studentUserId,
    student: link.studentUserId,
    relationship: link.relationship,
    profile: (() => {
      if (!profile) return profile;
      const next = typeof profile.toObject === 'function' ? profile.toObject() : { ...profile };
      delete next.whatsappNumber;
      delete next.identity;
      return next;
    })(),
    summary: {
      upcomingCount: upcomingPage.total || upcomingClasses.length,
      totalBookings: bookings.length,
      homeworkCount: homework.length,
      homeworkOpen:
        (homeworkByStatus.assigned || 0) + (homeworkByStatus.submitted || 0),
      studyStreak: progress?.studyStreak || profile?.studyStreak || 0,
      paidTotal,
      pendingTotal,
      paidByCurrency,
      pendingByCurrency,
      attendancePresent: attendance.present || 0,
      attendanceAbsent: attendance.absent || 0,
    },
    attendance,
    bookingByStatus,
    homeworkByStatus,
    paymentsByStatus,
    upcomingClasses: sanitizeBookingItems(upcomingClasses, 'parent'),
    recentClasses: sanitizeBookingItems(pastClasses, 'parent'),
    homework: homework.slice(0, 10),
    payments: payments.slice(0, 10),
    progress,
    predictedGrades: profile?.predictedGrades || {},
  };
}

module.exports = { linkStudent, myChildren, dashboard };
