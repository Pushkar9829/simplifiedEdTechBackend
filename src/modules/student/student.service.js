const bookingRepo = require('../booking/booking.repo');
const homeworkRepo = require('../homework/homework.repo');
const progressService = require('../progress/progress.service');
const notificationRepo = require('../notification/notification.repo');
const messageRepo = require('../message/message.repo');
const userRepo = require('../user/user.repo');
const { ASSIGNMENT_STATUS } = require('../../common/constants');
const { sanitizeBookingItems } = require('../../utils/tutorPrivacy');

async function getDashboard(studentUserId) {
  const now = new Date();
  const [
    bookings,
    homework,
    progress,
    notifications,
    conversations,
    profile,
  ] = await Promise.all([
    bookingRepo.list({ studentUserId }, { page: 1, limit: 20 }),
    homeworkRepo.listAssignments({ studentUserId }, { page: 1, limit: 20 }),
    progressService.myProgress(studentUserId),
    notificationRepo.listByUser(studentUserId, { page: 1, limit: 10 }),
    messageRepo.listConversations(studentUserId),
    userRepo.getStudentProfile(studentUserId),
  ]);

  const upcomingClasses = bookings.items.filter(
    (b) => new Date(b.startAt) >= now && !['cancelled'].includes(b.status)
  );
  const homeworkDue = homework.items.filter((h) =>
    [ASSIGNMENT_STATUS.ASSIGNED, ASSIGNMENT_STATUS.SUBMITTED, ASSIGNMENT_STATUS.OVERDUE].includes(
      h.status
    )
  );
  const recentGrades = (progress.records || [])
    .filter((r) => r.metricType === 'homework' || r.scoreLabel)
    .slice(0, 8);
  const upcomingDeadlines = homeworkDue
    .filter((h) => h.deadline)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 8);
  const recentActivity = [
    ...bookings.items.slice(0, 5).map((b) => ({
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

  const unreadNotifications = (notifications.items || []).filter((n) => !n.isRead).length;

  return {
    upcomingClasses: sanitizeBookingItems(upcomingClasses, 'student'),
    homeworkDue,
    recentGrades,
    tutorMessages: conversations.slice(0, 5),
    studyStreak: profile?.studyStreak || 0,
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
