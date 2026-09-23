const mongoose = require('mongoose');
const User = require('../user/user.model');
const Booking = require('../booking/booking.model');
const Subject = require('../subject/subject.model');
const { TutorProfile, StudentProfile } = require('../user/profile.model');
const {
  TutorSubject,
  TutorReview,
  TutorVerification,
  LessonPlan,
} = require('../tutor/tutor.model');
const { Payment, SubscriptionPlan } = require('../payment/payment.model');
const { Assignment, Submission } = require('../homework/homework.model');
const { Resource } = require('../resource/resource.model');
const { ProgressRecord, StudentBadge } = require('../progress/progress.model');
const ParentStudentLink = require('../parent/parent.model');
const { Conversation, Message } = require('../message/message.model');
const Notification = require('../notification/notification.model');
const {
  Announcement,
  SupportTicket,
} = require('../cms/cms.model');
const paymentRepo = require('../payment/payment.repo');
const cmsRepo = require('../cms/cms.repo');
const bookingRepo = require('../booking/booking.repo');

function hasVerificationDoc(field) {
  return {
    $cond: [
      {
        $or: [
          { $gt: [{ $size: { $ifNull: [`$documents.${field}`, []] } }, 0] },
          { $gt: [{ $strLenCP: { $ifNull: [`$${field}Doc`, ''] } }, 0] },
        ],
      },
      1,
      0,
    ],
  };
}

function groupCount(Model, field, match = {}) {
  return Model.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
}

function trendByDay(Model, dateField = 'createdAt', limit = 30, match = {}) {
  return Model.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: limit },
  ]);
}

async function subjectPopularity() {
  const [byOfferings, byBookings] = await Promise.all([
    TutorSubject.aggregate([
      { $group: { _id: '$subjectId', tutors: { $sum: 1 } } },
      { $sort: { tutors: -1 } },
      { $limit: 15 },
    ]),
    Booking.aggregate([
      { $group: { _id: '$subjectId', bookings: { $sum: 1 } } },
      { $sort: { bookings: -1 } },
      { $limit: 15 },
    ]),
  ]);

  const ids = [
    ...new Set(
      [...byOfferings, ...byBookings]
        .map((r) => r._id?.toString())
        .filter(Boolean)
    ),
  ];
  const subjects = await Subject.find({ _id: { $in: ids } }).select('name code');
  const nameMap = Object.fromEntries(
    subjects.map((s) => [s._id.toString(), { name: s.name, code: s.code }])
  );

  const bookingMap = Object.fromEntries(
    byBookings.map((r) => [r._id.toString(), r.bookings])
  );
  const offeringMap = Object.fromEntries(
    byOfferings.map((r) => [r._id.toString(), r.tutors])
  );

  return ids.map((id) => ({
    subjectId: id,
    name: nameMap[id]?.name || 'Unknown',
    code: nameMap[id]?.code || '',
    tutors: offeringMap[id] || 0,
    bookings: bookingMap[id] || 0,
  })).sort((a, b) => b.bookings - a.bookings || b.tutors - a.tutors);
}

async function overview() {
  const [
    usersByRole,
    usersByStatus,
    bookingStatus,
    attendanceSummary,
    revenue,
    paymentsByStatus,
    paymentTrend,
    tutorCount,
    studentCount,
    parentCount,
    approvedTutors,
    pendingTutors,
    rejectedTutors,
    pendingVerifications,
    verificationDocs,
    campaigns,
    subjectPopularityRows,
    configs,
    tutorPerformance,
    homeworkByStatus,
    submissionCount,
    resourcesByType,
    activeResources,
    activePlans,
    planCount,
    ticketsByStatus,
    openTickets,
    announcementsActive,
    parentLinks,
    conversationCount,
    messageCount,
    unreadNotifications,
    progressHours,
    badgesAwarded,
    lessonPlans,
    studyStreakStats,
    registrations,
    bookingTrend,
  ] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    groupCount(User, 'status'),
    bookingRepo.countByStatus(),
    groupCount(Booking, 'attendance'),
    paymentRepo.revenuePaid(),
    groupCount(Payment, 'status'),
    trendByDay(Payment, 'createdAt', 30, { status: 'paid' }),
    User.countDocuments({ role: 'tutor' }),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'parent' }),
    TutorProfile.countDocuments({ verificationStatus: 'approved' }),
    TutorProfile.countDocuments({ verificationStatus: 'pending' }),
    TutorProfile.countDocuments({ verificationStatus: 'rejected' }),
    TutorVerification.countDocuments({ status: 'pending' }),
    TutorVerification.aggregate([
      {
        $group: {
          _id: null,
          withIdentity: { $sum: hasVerificationDoc('identity') },
          withDegree: { $sum: hasVerificationDoc('degree') },
          withCertificate: { $sum: hasVerificationDoc('certificate') },
          withResume: { $sum: hasVerificationDoc('resume') },
          total: { $sum: 1 },
        },
      },
    ]),
    cmsRepo.listCampaigns(),
    subjectPopularity(),
    cmsRepo.listConfigs(),
    getTutorPerformance(),
    groupCount(Assignment, 'status'),
    Submission.countDocuments(),
    groupCount(Resource, 'type', { isActive: true }),
    Resource.countDocuments({ isActive: true }),
    SubscriptionPlan.countDocuments({ isActive: true }),
    SubscriptionPlan.countDocuments(),
    groupCount(SupportTicket, 'status'),
    SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    Announcement.countDocuments({ isActive: true }),
    ParentStudentLink.countDocuments({ status: 'active' }),
    Conversation.countDocuments(),
    Message.countDocuments(),
    Notification.countDocuments({ isRead: false }),
    ProgressRecord.aggregate([
      { $group: { _id: null, totalHours: { $sum: '$hours' }, records: { $sum: 1 } } },
    ]),
    StudentBadge.countDocuments(),
    LessonPlan.countDocuments(),
    StudentProfile.aggregate([
      {
        $group: {
          _id: null,
          avgStreak: { $avg: '$studyStreak' },
          maxStreak: { $max: '$studyStreak' },
          studentsWithStreak: {
            $sum: { $cond: [{ $gt: ['$studyStreak', 0] }, 1, 0] },
          },
        },
      },
    ]),
    trendByDay(User, 'createdAt', 30),
    trendByDay(Booking, 'createdAt', 30),
  ]);

  const totalRevenue = (revenue || []).reduce((sum, r) => sum + (r.total || 0), 0);
  const paidPaymentCount = (revenue || []).reduce((sum, r) => sum + (r.count || 0), 0);
  const totalBookings = (bookingStatus || []).reduce((sum, r) => sum + (r.count || 0), 0);
  const totalUsers = (usersByRole || []).reduce((sum, r) => sum + (r.count || 0), 0);

  const campaignSummary = {
    count: campaigns.length,
    totalSpend: campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0),
    totalLeads: campaigns.reduce((s, c) => s + (Number(c.leads) || 0), 0),
    totalConversions: campaigns.reduce((s, c) => s + (Number(c.conversions) || 0), 0),
  };
  campaignSummary.conversionRate =
    campaignSummary.totalLeads > 0
      ? Math.round((campaignSummary.totalConversions / campaignSummary.totalLeads) * 1000) / 10
      : 0;

  const homeworkAssigned =
    (homeworkByStatus || []).find((h) => h._id === 'assigned')?.count || 0;
  const homeworkSubmitted =
    (homeworkByStatus || []).find((h) => h._id === 'submitted')?.count || 0;
  const homeworkGraded =
    (homeworkByStatus || []).find((h) => h._id === 'graded')?.count || 0;
  const homeworkTotal = (homeworkByStatus || []).reduce((s, h) => s + h.count, 0);

  return {
    live: {
      summary: {
        totalUsers,
        studentCount,
        tutorCount,
        parentCount,
        approvedTutors,
        pendingTutors,
        rejectedTutors,
        pendingVerifications,
        totalBookings,
        totalRevenue,
        paidPaymentCount,
        openTickets,
        activeResources,
        activePlans,
        announcementsActive,
        parentLinks,
        unreadNotifications,
      },
      usersByRole,
      usersByStatus,
      bookingStatus,
      attendanceSummary,
      revenue,
      paymentsByStatus,
      paymentTrend,
      subjectPopularity: subjectPopularityRows,
      registrations,
      bookingTrend,
      tutorPerformance,
      homework: {
        byStatus: homeworkByStatus,
        submissionCount,
        total: homeworkTotal,
        assigned: homeworkAssigned,
        submitted: homeworkSubmitted,
        graded: homeworkGraded,
        completionRate:
          homeworkTotal > 0
            ? Math.round(((homeworkSubmitted + homeworkGraded) / homeworkTotal) * 1000) / 10
            : 0,
      },
      learning: {
        resourcesByType,
        activeResources,
        progressHours: progressHours[0]?.totalHours || 0,
        progressRecords: progressHours[0]?.records || 0,
        badgesAwarded,
        lessonPlans,
        studyStreak: {
          avg: studyStreakStats[0]
            ? Math.round((studyStreakStats[0].avgStreak || 0) * 10) / 10
            : 0,
          max: studyStreakStats[0]?.maxStreak || 0,
          studentsWithStreak: studyStreakStats[0]?.studentsWithStreak || 0,
        },
      },
      engagement: {
        conversations: conversationCount,
        messages: messageCount,
        unreadNotifications,
        parentLinks,
      },
      verification: {
        pending: pendingVerifications,
        approvedTutors,
        pendingTutors,
        rejectedTutors,
        docs: verificationDocs[0] || {
          withIdentity: 0,
          withDegree: 0,
          withCertificate: 0,
          withResume: 0,
          total: 0,
        },
      },
      support: {
        byStatus: ticketsByStatus,
        openTickets,
      },
      subscriptions: {
        activePlans,
        planCount,
      },
    },
    adminFed: {
      campaigns,
      campaignSummary,
      configs,
    },
  };
}

async function getTutorPerformance(limit = 20) {
  const tutors = await TutorProfile.find({ verificationStatus: 'approved' })
    .populate('userId', 'name phone')
    .sort({ ratingAvg: -1 })
    .limit(limit);

  const ids = tutors.map((t) => t.userId?._id || t.userId).filter(Boolean);
  if (!ids.length) return [];

  const [bookings, earnings, homework, reviews] = await Promise.all([
    Booking.aggregate([
      { $match: { tutorUserId: { $in: ids } } },
      {
        $group: {
          _id: '$tutorUserId',
          totalBookings: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
          present: {
            $sum: { $cond: [{ $eq: ['$attendance', 'present'] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$attendance', 'absent'] }, 1, 0] },
          },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { beneficiaryUserId: { $in: ids }, status: 'paid' } },
      {
        $group: {
          _id: '$beneficiaryUserId',
          revenue: { $sum: '$amount' },
          paidCount: { $sum: 1 },
        },
      },
    ]),
    Assignment.aggregate([
      { $match: { tutorUserId: { $in: ids } } },
      {
        $group: {
          _id: '$tutorUserId',
          assignments: { $sum: 1 },
          graded: {
            $sum: { $cond: [{ $eq: ['$status', 'graded'] }, 1, 0] },
          },
        },
      },
    ]),
    TutorReview.aggregate([
      { $match: { tutorUserId: { $in: ids } } },
      {
        $group: {
          _id: '$tutorUserId',
          reviewCount: { $sum: 1 },
          avgRating: { $avg: '$rating' },
        },
      },
    ]),
  ]);

  const mapBy = (rows) => Object.fromEntries(rows.map((r) => [r._id.toString(), r]));
  const bookingMap = mapBy(bookings);
  const earnMap = mapBy(earnings);
  const hwMap = mapBy(homework);
  const reviewMap = mapBy(reviews);

  return tutors.map((t) => {
    const id = (t.userId?._id || t.userId).toString();
    const b = bookingMap[id] || {};
    const e = earnMap[id] || {};
    const h = hwMap[id] || {};
    const r = reviewMap[id] || {};
    const total = b.totalBookings || 0;
    const present = b.present || 0;
    return {
      tutorUserId: id,
      name: t.userId?.name || '',
      phone: t.userId?.phone || '',
      ratingAvg: t.ratingAvg,
      ratingCount: t.ratingCount,
      experienceYears: t.experienceYears,
      hourlyRate: t.hourlyRate,
      totalBookings: total,
      completedBookings: b.completed || 0,
      cancelledBookings: b.cancelled || 0,
      presentSessions: present,
      absentSessions: b.absent || 0,
      attendanceRate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      revenue: e.revenue || 0,
      paidInvoices: e.paidCount || 0,
      assignmentsCreated: h.assignments || 0,
      assignmentsGraded: h.graded || 0,
      reviewAvg: r.avgRating ? Math.round(r.avgRating * 10) / 10 : t.ratingAvg,
      reviewCount: r.reviewCount || t.ratingCount,
    };
  });
}

async function tutorDetail(tutorUserId) {
  if (!mongoose.Types.ObjectId.isValid(tutorUserId)) {
    return null;
  }
  const oid = new mongoose.Types.ObjectId(tutorUserId);
  const base = (await getTutorPerformance(500)).find((t) => t.tutorUserId === tutorUserId);
  if (!base) return null;

  const [recentBookings, recentPayments, subjects, reviews] = await Promise.all([
    Booking.find({ tutorUserId: oid })
      .sort({ startAt: -1 })
      .limit(8)
      .populate('subjectId', 'name')
      .populate('studentUserId', 'name phone')
      .select('status attendance startAt endAt amount currency subjectId studentUserId'),
    Payment.find({ beneficiaryUserId: oid })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('amount currency status description createdAt'),
    TutorSubject.find({ tutorUserId: oid }).populate('subjectId', 'name code').select('level hourlyRate subjectId'),
    TutorReview.find({ tutorUserId: oid })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('studentUserId', 'name')
      .select('rating comment createdAt studentUserId'),
  ]);

  return {
    ...base,
    subjects: subjects.map((s) => ({
      name: s.subjectId?.name || '—',
      code: s.subjectId?.code || '',
      level: s.level,
      hourlyRate: s.hourlyRate,
    })),
    recentBookings,
    recentPayments,
    recentReviews: reviews,
  };
}

module.exports = { overview, getTutorPerformance, tutorDetail };
