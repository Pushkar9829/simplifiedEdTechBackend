const parentRepo = require('./parent.repo');
const userRepo = require('../user/user.repo');
const bookingRepo = require('../booking/booking.repo');
const homeworkRepo = require('../homework/homework.repo');
const paymentRepo = require('../payment/payment.repo');
const progressService = require('../progress/progress.service');
const ApiError = require('../../common/ApiError');
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

  const [bookingsPage, homeworkPage, paymentsPage, progress, profile] = await Promise.all([
    bookingRepo.list({ studentUserId }, { page: 1, limit: 50 }),
    homeworkRepo.listAssignments({ studentUserId }, { page: 1, limit: 50 }),
    paymentRepo.listPayments(
      { $or: [{ payerUserId: studentUserId }, { payerUserId: parentUserId }] },
      { page: 1, limit: 50 }
    ),
    progressService.myProgress(studentUserId),
    userRepo.getStudentProfile(studentUserId),
  ]);

  const bookings = bookingsPage.items || [];
  const homework = homeworkPage.items || [];
  const payments = paymentsPage.items || [];
  const now = new Date();

  const upcomingClasses = bookings
    .filter((b) => new Date(b.startAt) >= now && b.status !== 'cancelled')
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

  const pastClasses = bookings
    .filter((b) => new Date(b.startAt) < now)
    .sort((a, b) => new Date(b.startAt) - new Date(a.startAt));

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
  payments.forEach((p) => {
    paymentsByStatus[p.status] = (paymentsByStatus[p.status] || 0) + 1;
    if (p.status === 'paid') paidTotal += p.amount || 0;
    if (['pending', 'awaiting_confirmation'].includes(p.status)) {
      pendingTotal += p.amount || 0;
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
    profile,
    summary: {
      upcomingCount: upcomingClasses.length,
      totalBookings: bookings.length,
      homeworkCount: homework.length,
      homeworkOpen:
        (homeworkByStatus.assigned || 0) + (homeworkByStatus.submitted || 0),
      studyStreak: progress?.studyStreak || profile?.studyStreak || 0,
      paidTotal,
      pendingTotal,
      attendancePresent: attendance.present || 0,
      attendanceAbsent: attendance.absent || 0,
    },
    attendance,
    bookingByStatus,
    homeworkByStatus,
    paymentsByStatus,
    upcomingClasses: sanitizeBookingItems(upcomingClasses.slice(0, 8), 'parent'),
    recentClasses: sanitizeBookingItems(pastClasses.slice(0, 6), 'parent'),
    homework: homework.slice(0, 10),
    payments: payments.slice(0, 10),
    progress,
    predictedGrades: profile?.predictedGrades || {},
  };
}

module.exports = { linkStudent, myChildren, dashboard };
