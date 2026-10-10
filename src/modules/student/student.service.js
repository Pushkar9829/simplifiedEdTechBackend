const bookingRepo = require('../booking/booking.repo');
const Booking = require('../booking/booking.model');
const homeworkRepo = require('../homework/homework.repo');
const progressService = require('../progress/progress.service');
const notificationRepo = require('../notification/notification.repo');
const messageService = require('../message/message.service');
const userRepo = require('../user/user.repo');
const { ASSIGNMENT_STATUS, BOOKING_STATUS } = require('../../common/constants');
const { sanitizeBookingItems } = require('../../utils/tutorPrivacy');

async function getDashboard(studentUserId) {
  const now = new Date();
  const [
    upcoming,
    recentBookings,
    homework,
    progress,
    unreadNotifications,
    conversations,
    profile,
  ] = await Promise.all([
    bookingRepo.list(
      { studentUserId, startAt: { $gte: now }, status: { $ne: BOOKING_STATUS.CANCELLED } },
      { page: 1, limit: 20 }
    ),
    Booking.find({ studentUserId }).select('status createdAt updatedAt').sort({ updatedAt: -1 }).limit(5),
    homeworkRepo.listAssignments({ studentUserId }, { page: 1, limit: 20 }),
    progressService.myProgress(studentUserId),
    notificationRepo.countUnread(studentUserId),
    messageService.listConversations({ id: studentUserId, role: 'student' }),
    userRepo.getStudentProfile(studentUserId),
  ]);

  const upcomingClasses = upcoming.items;
  const homeworkDue = homework.items.filter((h) =>
    [ASSIGNMENT_STATUS.ASSIGNED, ASSIGNMENT_STATUS.OVERDUE].includes(h.status)
  );
  const recentGrades = (progress.records || [])
    .filter((r) => r.metricType === 'homework' || r.scoreLabel)
    .slice(0, 8);
  const upcomingDeadlines = homeworkDue
    .filter((h) => h.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 8);
  const recentActivity = [
    ...recentBookings.map((b) => ({
      type: 'booking',
      at: b.updatedAt || b.createdAt,
      summary: `Class ${b.status}`,
      refId: b._id,
    })),
    ...homework.items.slice(0, 5).map((h) => ({
      type: 'homework',
      at: h.updatedAt || h.createdAt,
      summary: h.title,
      refId: h._id,
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 10);

  return {
    upcomingClasses: sanitizeBookingItems(upcomingClasses, 'student'),
    homeworkDue,
    recentGrades,
    tutorMessages: conversations.slice(0, 5),
    studyStreak: profile?.studyStreak || 0,
    credits: progress.credits || profile?.progressCredits || 0,
    stars: progress.stars || profile?.progressStars || 0,
    level: progress.level || profile?.progressLevel || 'Starter',
    recommendedStudyPlan: {
      focusTopics: progress.weakTopics || [],
      strongTopics: progress.strongTopics || [],
      tip:
        (progress.weakTopics || []).length > 0
          ? `Prioritize: ${(progress.weakTopics || []).slice(0, 3).join(', ')}`
          : 'Keep up consistent weekly study hours',
    },
    upcomingDeadlines,
    recentActivity,
    academicPerformanceSummary: {
      bySubject: progress.bySubject || [],
      badges: progress.badges || [],
      predictedGrades: profile?.predictedGrades || {},
    },
    unreadNotifications,
  };
}

module.exports = { getDashboard };
