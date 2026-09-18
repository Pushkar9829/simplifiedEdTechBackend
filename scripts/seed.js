/**
 * Full demo seed — fills every application collection for local testing.
 * Run: npm run seed
 *
 * Demo phones (OTP from DEMO_OTP, default 123456):
 *   admin 9999999999 | tutor 8888888888 | student 7777777777 | parent 6666666666
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const env = require('../src/config/env');
const {
  IBDP_SUBJECTS,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  ASSIGNMENT_STATUS,
  VERIFICATION_STATUS,
  RESOURCE_TYPES,
} = require('../src/common/constants');

const User = require('../src/modules/user/user.model');
const {
  StudentProfile,
  TutorProfile,
  ParentProfile,
} = require('../src/modules/user/profile.model');
const Subject = require('../src/modules/subject/subject.model');
const {
  TutorSubject,
  AvailabilitySlot,
  TutorVerification,
  TutorReview,
  StudentNote,
  LessonPlan,
  TutorVideo,
} = require('../src/modules/tutor/tutor.model');
const { Board, ClassLevel } = require('../src/modules/catalog/catalog.model');
const { Wallet, WalletTransaction, Withdrawal } = require('../src/modules/wallet/wallet.model');
const Booking = require('../src/modules/booking/booking.model');
const { Payment, SubscriptionPlan } = require('../src/modules/payment/payment.model');
const { Resource, ResourceBookmark } = require('../src/modules/resource/resource.model');
const { Assignment, Submission } = require('../src/modules/homework/homework.model');
const {
  ProgressRecord,
  Badge,
  StudentBadge,
} = require('../src/modules/progress/progress.model');
const ParentStudentLink = require('../src/modules/parent/parent.model');
const { Conversation, Message } = require('../src/modules/message/message.model');
const Notification = require('../src/modules/notification/notification.model');
const {
  Announcement,
  CampaignMetric,
  PlatformConfig,
  SupportTicket,
} = require('../src/modules/cms/cms.model');
const OtpSession = require('../src/modules/auth/auth.model');

async function clearAll() {
  const collections = [
    Message,
    Conversation,
    Notification,
    Submission,
    Assignment,
    ResourceBookmark,
    Resource,
    Payment,
    Booking,
    LessonPlan,
    StudentNote,
    TutorReview,
    TutorVerification,
    AvailabilitySlot,
    TutorSubject,
    ParentStudentLink,
    StudentBadge,
    ProgressRecord,
    Badge,
    SupportTicket,
    CampaignMetric,
    Announcement,
    PlatformConfig,
    SubscriptionPlan,
    StudentProfile,
    TutorProfile,
    ParentProfile,
    Withdrawal,
    WalletTransaction,
    Wallet,
    TutorVideo,
    ClassLevel,
    Board,
    Subject,
    User,
    OtpSession,
  ];
  for (const Model of collections) {
    await Model.deleteMany({});
  }
  console.log('Cleared existing collections');
}

async function ensureDemoUploads() {
  const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
  if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });
  const pdf = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 55 >>stream
BT /F1 18 Tf 40 80 Td (Demo verification document) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000262 00000 n 
0000000367 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
444
%%EOF
`;
  const files = [
    'pending-id.pdf',
    'pending-degree.pdf',
    'demo-id.pdf',
    'demo-degree.pdf',
    'demo-cert.pdf',
    'demo-resume.pdf',
  ];
  for (const name of files) {
    fs.writeFileSync(path.join(uploadRoot, name), pdf);
  }
}

async function seed() {
  await mongoose.connect(env.mongoUri);
  console.log('Connected for seed');

  await ensureDemoUploads();
  await clearAll();

  // ── Subjects ────────────────────────────────────────────
  const subjectDocs = await Subject.insertMany(
    IBDP_SUBJECTS.map((name) => ({
      name,
      code: name
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 8)
        .toUpperCase(),
      levels: name.includes('HL') ? ['HL'] : name.includes('SL') ? ['SL'] : ['HL', 'SL'],
      category: 'ibdp',
      description: `${name} for IB Diploma Programme`,
      isActive: true,
    }))
  );
  const boards = await Board.insertMany([
    { name: 'IB Diploma', code: 'IBDP', isActive: true },
    { name: 'CBSE', code: 'CBSE', isActive: true },
    { name: 'ICSE', code: 'ICSE', isActive: true },
  ]);
  const classLevels = await ClassLevel.insertMany([
    { name: 'Grade 9', sortOrder: 9 },
    { name: 'Grade 10', sortOrder: 10 },
    { name: 'DP1', sortOrder: 11 },
    { name: 'DP2', sortOrder: 12 },
  ]);
  const ibBoard = boards[0];
  const dp2 = classLevels.find((c) => c.name === 'DP2');

  const physics = subjectDocs.find((s) => s.name === 'Physics') || subjectDocs[0];
  const math = subjectDocs.find((s) => s.name.includes('Mathematics AA HL')) || subjectDocs[1];
  const chem = subjectDocs.find((s) => s.name === 'Chemistry') || subjectDocs[2];
  console.log(`Subjects: ${subjectDocs.length}`);

  // ── Users + profiles ────────────────────────────────────
  const admin = await User.create({
    phone: '9999999999',
    role: 'admin',
    name: 'Platform Admin',
    email: 'admin@ibdp.demo',
    status: 'active',
    timezone: 'UTC',
    country: 'India',
  });

  const tutor = await User.create({
    phone: '8888888888',
    role: 'tutor',
    name: 'Demo Tutor',
    email: 'tutor@ibdp.demo',
    status: 'active',
    country: 'India',
    timezone: 'Asia/Kolkata',
  });

  const tutorPending = await User.create({
    phone: '8888888881',
    role: 'tutor',
    name: 'Pending Tutor',
    status: 'active',
    timezone: 'Asia/Kolkata',
  });

  const student = await User.create({
    phone: '7777777777',
    role: 'student',
    name: 'Demo Student',
    email: 'student@ibdp.demo',
    status: 'active',
    timezone: 'Asia/Kolkata',
    country: 'India',
  });

  const parent = await User.create({
    phone: '6666666666',
    role: 'parent',
    name: 'Demo Parent',
    email: 'parent@ibdp.demo',
    status: 'active',
    timezone: 'Asia/Kolkata',
  });

  await TutorProfile.create({
    userId: tutor._id,
    qualifications: 'IB Examiner',
    university: 'Demo University',
    degree: 'MSc Physics',
    experienceYears: 5,
    languages: ['English', 'Hindi'],
    bio: 'Experienced IB Physics and Math tutor.',
    hourlyRate: 40,
    hourlyRateOnline: 40,
    hourlyRateOffline: 50,
    teachingMode: 'both',
    location: { city: 'Bengaluru', area: 'Indiranagar', address: 'Demo Learning Studio' },
    currency: 'USD',
    ratingAvg: 4.8,
    ratingCount: 1,
    trialLessonAvailable: true,
    verificationStatus: 'approved',
  });

  await TutorProfile.create({
    userId: tutorPending._id,
    qualifications: 'BSc Chemistry',
    experienceYears: 2,
    languages: ['English'],
    hourlyRate: 30,
    verificationStatus: 'pending',
  });

  await StudentProfile.create({
    userId: student._id,
    school: 'Demo International School',
    gradeYear: 'DP2',
    subjectIds: [physics._id, math._id, chem._id],
    boardId: ibBoard._id,
    classLevelId: dp2._id,
    studyStreak: 3,
    lastActivityDate: dayjs().format('YYYY-MM-DD'),
    predictedGrades: { Physics: '6', Math: '5' },
  });

  await ParentProfile.create({ userId: parent._id });
  console.log('Users + profiles seeded');

  // ── Tutor offerings / availability / verification ───────
  await TutorSubject.insertMany([
    {
      tutorUserId: tutor._id,
      subjectId: physics._id,
      level: 'HL',
      hourlyRate: 45,
      boardId: ibBoard._id,
      classLevelId: dp2._id,
    },
    {
      tutorUserId: tutor._id,
      subjectId: math._id,
      level: 'HL',
      hourlyRate: 50,
      boardId: ibBoard._id,
      classLevelId: dp2._id,
    },
    {
      tutorUserId: tutor._id,
      subjectId: chem._id,
      level: 'SL',
      hourlyRate: 40,
      boardId: ibBoard._id,
      classLevelId: dp2._id,
    },
  ]);

  const slotStart = dayjs().add(2, 'day').hour(10).minute(0).second(0).millisecond(0);
  const freeSlot = await AvailabilitySlot.create({
    tutorUserId: tutor._id,
    startAt: slotStart.toDate(),
    endAt: slotStart.add(1, 'hour').toDate(),
    timezone: 'Asia/Kolkata',
    deliveryMode: 'online',
    isBooked: false,
  });
  const bookedSlotStart = dayjs().add(2, 'day').hour(15).minute(0).second(0);
  const bookedSlot = await AvailabilitySlot.create({
    tutorUserId: tutor._id,
    startAt: bookedSlotStart.toDate(),
    endAt: bookedSlotStart.add(1, 'hour').toDate(),
    timezone: 'Asia/Kolkata',
    deliveryMode: 'offline',
    isBooked: true,
  });
  await AvailabilitySlot.create({
    tutorUserId: tutor._id,
    startAt: dayjs().add(3, 'day').hour(11).toDate(),
    endAt: dayjs().add(3, 'day').hour(12).toDate(),
    timezone: 'Asia/Kolkata',
    deliveryMode: 'offline',
    isBooked: false,
  });

  await TutorVideo.create({
    tutorUserId: tutor._id,
    title: 'Introduction',
    kind: 'intro',
    fileUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    isActive: true,
  });

  await TutorVerification.create({
    tutorUserId: tutor._id,
    identityDoc: '/uploads/demo-id.pdf',
    degreeDoc: '/uploads/demo-degree.pdf',
    certificateDoc: '/uploads/demo-cert.pdf',
    resumeDoc: '/uploads/demo-resume.pdf',
    notes: 'Demo approved verification',
    status: VERIFICATION_STATUS.APPROVED,
    adminNote: 'Looks good',
    reviewedAt: new Date(),
  });

  await TutorVerification.create({
    tutorUserId: tutorPending._id,
    identityDoc: '/uploads/pending-id.pdf',
    degreeDoc: '/uploads/pending-degree.pdf',
    notes: 'Awaiting admin review',
    status: VERIFICATION_STATUS.PENDING,
  });

  await TutorReview.create({
    tutorUserId: tutor._id,
    studentUserId: student._id,
    rating: 5,
    comment: 'Clear explanations and great notes.',
  });

  await StudentNote.create({
    tutorUserId: tutor._id,
    studentUserId: student._id,
    note: 'Strong on mechanics; needs work on electricity.',
    tags: ['mechanics', 'follow-up'],
  });

  console.log('Tutor offerings / verification / notes seeded');

  // ── Bookings ────────────────────────────────────────────
  const bookingConfirmed = await Booking.create({
    studentUserId: student._id,
    tutorUserId: tutor._id,
    subjectId: physics._id,
    level: 'HL',
    slotId: bookedSlot._id,
    startAt: bookedSlot.startAt,
    endAt: bookedSlot.endAt,
    timezone: 'Asia/Kolkata',
    status: BOOKING_STATUS.CONFIRMED,
    amount: 45,
    currency: 'USD',
    notes: 'Wave optics intro',
    attendance: 'pending',
    deliveryMode: 'offline',
    bookedByUserId: student._id,
  });

  const bookingCompleted = await Booking.create({
    studentUserId: student._id,
    tutorUserId: tutor._id,
    subjectId: math._id,
    level: 'HL',
    startAt: dayjs().subtract(5, 'day').hour(16).toDate(),
    endAt: dayjs().subtract(5, 'day').hour(17).toDate(),
    timezone: 'Asia/Kolkata',
    status: BOOKING_STATUS.COMPLETED,
    amount: 50,
    currency: 'USD',
    attendance: 'present',
    deliveryMode: 'online',
    meetingUrl: 'https://zoom.us/j/seedcompleted',
    bookedByUserId: student._id,
  });

  await Booking.create({
    studentUserId: student._id,
    tutorUserId: tutor._id,
    subjectId: chem._id,
    level: 'SL',
    startAt: dayjs().add(7, 'day').hour(9).toDate(),
    endAt: dayjs().add(7, 'day').hour(10).toDate(),
    timezone: 'Asia/Kolkata',
    status: BOOKING_STATUS.PENDING,
    amount: 40,
    currency: 'USD',
  });

  await LessonPlan.create({
    tutorUserId: tutor._id,
    studentUserId: student._id,
    subjectId: physics._id,
    title: 'Circular motion & gravity',
    objectives: 'Derive centripetal acceleration; apply Newton gravity',
    content: 'Warm-up → worked examples → past paper Qs',
    resources: ['formula sheet'],
    scheduledFor: bookingConfirmed.startAt,
    bookingId: bookingConfirmed._id,
    status: 'ready',
  });

  console.log('Bookings + lesson plans seeded');

  // ── Payments + plans ────────────────────────────────────
  const starter = await SubscriptionPlan.create({
    name: 'Starter Pack',
    description: '4 lesson credits',
    price: 99,
    currency: 'USD',
    billingCycle: 'one_time',
    features: ['4 lessons', 'Homework support'],
    isActive: true,
  });
  await SubscriptionPlan.create({
    name: 'Monthly Unlimited',
    description: 'Unlimited tutoring within fair use',
    price: 249,
    currency: 'USD',
    billingCycle: 'monthly',
    features: ['Unlimited sessions', 'Priority booking'],
    isActive: true,
  });

  await Payment.create({
    payerUserId: student._id,
    beneficiaryUserId: tutor._id,
    bookingId: bookingConfirmed._id,
    amount: 45,
    currency: 'USD',
    method: 'manual',
    status: PAYMENT_STATUS.AWAITING_CONFIRMATION,
    description: 'Payment for upcoming Physics session',
  });
  await Payment.create({
    payerUserId: parent._id,
    beneficiaryUserId: tutor._id,
    bookingId: bookingCompleted._id,
    amount: 50,
    currency: 'USD',
    method: 'manual',
    status: PAYMENT_STATUS.PAID,
    description: 'Parent paid Math session',
    paidAt: dayjs().subtract(4, 'day').toDate(),
    adminNote: 'Confirmed manually',
  });

  const tutorWallet = await Wallet.create({
    ownerType: 'user',
    ownerUserId: tutor._id,
    balance: 37.5,
    currency: 'USD',
  });
  await Wallet.create({
    ownerType: 'user',
    ownerUserId: student._id,
    balance: 80,
    currency: 'USD',
  });
  await Wallet.create({
    ownerType: 'user',
    ownerUserId: parent._id,
    balance: 120,
    currency: 'USD',
  });
  const platformWallet = await Wallet.create({
    ownerType: 'platform',
    ownerUserId: null,
    balance: 12.5,
    currency: 'USD',
  });
  await WalletTransaction.create({
    walletId: tutorWallet._id,
    type: 'credit',
    amount: 37.5,
    description: 'Lesson payout (75%)',
    refType: 'payment',
  });
  await WalletTransaction.create({
    walletId: platformWallet._id,
    type: 'credit',
    amount: 12.5,
    description: 'Platform commission (25%)',
    refType: 'payment',
  });
  await Payment.create({
    payerUserId: student._id,
    planId: starter._id,
    amount: 99,
    currency: 'USD',
    method: 'manual',
    status: PAYMENT_STATUS.PENDING,
    description: 'Starter Pack subscription',
  });
  await Payment.create({
    payerUserId: student._id,
    amount: 40,
    currency: 'USD',
    method: 'manual',
    status: PAYMENT_STATUS.FAILED,
    description: 'Failed demo payment',
    adminNote: 'Card declined (demo)',
  });

  console.log('Plans + payments seeded');

  // ── Resources ───────────────────────────────────────────
  const resources = await Resource.insertMany(
    RESOURCE_TYPES.slice(0, 5).map((type, i) => ({
      title: `Demo ${type.replace(/_/g, ' ')}`,
      description: `Sample ${type} for IB testing`,
      subjectId: i % 2 === 0 ? physics._id : math._id,
      level: 'HL',
      topic: i % 2 === 0 ? 'Mechanics' : 'Calculus',
      chapter: `Ch ${i + 1}`,
      academicYear: '2025-26',
      type,
      fileUrl: `/uploads/demo-${type}.pdf`,
      createdBy: i === 0 ? admin._id : tutor._id,
      isActive: true,
    }))
  );
  await ResourceBookmark.create({
    userId: student._id,
    resourceId: resources[0]._id,
  });

  // ── Homework ────────────────────────────────────────────
  const assignmentOpen = await Assignment.create({
    tutorUserId: tutor._id,
    studentUserId: student._id,
    subjectId: physics._id,
    level: 'HL',
    title: 'Past paper: SHM',
    description: 'Attempt Q1–Q3 from May 2023 TZ1',
    deadline: dayjs().add(5, 'day').toDate(),
    resourceIds: [resources[0]._id],
    rubric: 'Correct method + units',
    status: ASSIGNMENT_STATUS.ASSIGNED,
  });

  const assignmentSubmitted = await Assignment.create({
    tutorUserId: tutor._id,
    studentUserId: student._id,
    subjectId: math._id,
    level: 'HL',
    title: 'Integration worksheet',
    description: 'Complete sheet A',
    deadline: dayjs().add(2, 'day').toDate(),
    status: ASSIGNMENT_STATUS.SUBMITTED,
  });

  await Submission.create({
    assignmentId: assignmentSubmitted._id,
    studentUserId: student._id,
    files: ['/uploads/demo-hw.pdf'],
    notes: 'Attempted all questions',
    versionHistory: [
      {
        files: ['/uploads/demo-hw.pdf'],
        notes: 'Attempted all questions',
        submittedAt: new Date(),
      },
    ],
  });

  const assignmentGraded = await Assignment.create({
    tutorUserId: tutor._id,
    studentUserId: student._id,
    subjectId: chem._id,
    level: 'SL',
    title: 'Stoichiometry quiz',
    description: '10 short answers',
    deadline: dayjs().subtract(2, 'day').toDate(),
    status: ASSIGNMENT_STATUS.GRADED,
  });

  await Submission.create({
    assignmentId: assignmentGraded._id,
    studentUserId: student._id,
    files: ['/uploads/demo-chem.pdf'],
    notes: 'Done',
    grade: '7',
    feedback: 'Excellent work on limiting reagents',
    gradedAt: new Date(),
    versionHistory: [
      { files: ['/uploads/demo-chem.pdf'], notes: 'Done', submittedAt: dayjs().subtract(3, 'day').toDate() },
    ],
  });

  console.log('Resources + homework seeded');

  // ── Progress + badges ───────────────────────────────────
  const badgeFirst = await Badge.create({
    name: 'First Submission',
    description: 'Submitted first homework',
    criteria: 'Complete 1 homework submission',
    icon: 'star',
    isActive: true,
  });
  const badgeStreak = await Badge.create({
    name: 'Study Streak 3',
    description: 'Studied 3 days in a row',
    criteria: '3-day streak',
    isActive: true,
  });
  await StudentBadge.insertMany([
    { studentUserId: student._id, badgeId: badgeFirst._id },
    { studentUserId: student._id, badgeId: badgeStreak._id },
  ]);
  await ProgressRecord.insertMany([
    {
      studentUserId: student._id,
      subjectId: physics._id,
      topic: 'SHM',
      metricType: 'homework',
      scoreLabel: 'grade',
      scoreValue: 6,
      hours: 2,
    },
    {
      studentUserId: student._id,
      subjectId: math._id,
      topic: 'Integration',
      metricType: 'hours',
      hours: 3.5,
    },
    {
      studentUserId: student._id,
      subjectId: chem._id,
      topic: 'Stoichiometry',
      metricType: 'homework',
      scoreLabel: 'grade',
      scoreValue: 7,
      hours: 1.5,
    },
  ]);

  // ── Parent link ─────────────────────────────────────────
  await ParentStudentLink.create({
    parentUserId: parent._id,
    studentUserId: student._id,
    relationship: 'parent',
    status: 'active',
  });

  // ── Messages ────────────────────────────────────────────
  const convo = await Conversation.create({
    participants: [student._id, tutor._id],
    lastMessageAt: new Date(),
  });
  await Message.insertMany([
    {
      conversationId: convo._id,
      senderId: student._id,
      body: 'Hi! Can we focus on past papers tomorrow?',
      readBy: [student._id, tutor._id],
    },
    {
      conversationId: convo._id,
      senderId: tutor._id,
      body: 'Absolutely — bring May 2023 TZ1.',
      readBy: [tutor._id],
    },
  ]);
  const convoParent = await Conversation.create({
    participants: [parent._id, tutor._id],
    lastMessageAt: dayjs().subtract(1, 'hour').toDate(),
  });
  await Message.create({
    conversationId: convoParent._id,
    senderId: parent._id,
    body: 'How is my child progressing in Physics?',
    readBy: [parent._id],
  });

  // ── Notifications ───────────────────────────────────────
  await Notification.insertMany([
    {
      userId: student._id,
      title: 'Booking confirmed',
      body: 'Your Physics session is confirmed.',
      type: 'booking',
      meta: { bookingId: bookingConfirmed._id },
      isRead: false,
    },
    {
      userId: student._id,
      title: 'New homework',
      body: assignmentOpen.title,
      type: 'homework',
      isRead: false,
    },
    {
      userId: tutor._id,
      title: 'New booking',
      body: 'Demo Student booked a Physics session',
      type: 'booking',
      isRead: true,
    },
    {
      userId: parent._id,
      title: 'Payment awaiting confirmation',
      body: 'A payment for your child needs admin confirmation',
      type: 'payment',
      isRead: false,
    },
    {
      userId: admin._id,
      title: 'Verification pending',
      body: 'Pending Tutor submitted documents',
      type: 'verification',
      isRead: false,
    },
  ]);

  // ── CMS ─────────────────────────────────────────────────
  await Announcement.insertMany([
    {
      title: 'Welcome to IBDP Tutoring',
      body: 'Book verified IBDP tutors and track progress with your parents.',
      audience: 'all',
      isActive: true,
      createdBy: admin._id,
    },
    {
      title: 'Exam season tips',
      body: 'Prioritize past papers and sleep. Tutors available for crash sessions.',
      audience: 'student',
      isActive: true,
      createdBy: admin._id,
    },
  ]);

  await CampaignMetric.insertMany([
    {
      name: 'Launch Week',
      channel: 'organic',
      spend: 0,
      leads: 25,
      conversions: 8,
      notes: 'Admin-fed demo campaign',
      periodStart: dayjs().subtract(14, 'day').toDate(),
      periodEnd: dayjs().subtract(7, 'day').toDate(),
      createdBy: admin._id,
    },
    {
      name: 'Google Ads Q2',
      channel: 'paid_search',
      spend: 500,
      leads: 80,
      conversions: 22,
      notes: 'Demo paid campaign',
      createdBy: admin._id,
    },
  ]);

  await PlatformConfig.insertMany([
    {
      key: 'analytics.widgets',
      value: ['usersByRole', 'revenue', 'bookings', 'campaigns'],
      description: 'Enabled analytics widgets',
    },
    {
      key: 'supportEmail',
      value: 'support@ibdp.demo',
      description: 'Public support contact',
    },
    {
      key: 'booking.minHoursNotice',
      value: 12,
      description: 'Minimum hours before booking start',
    },
  ]);

  await SupportTicket.insertMany([
    {
      userId: student._id,
      subject: 'Cannot upload homework',
      description: 'File picker fails on mobile Safari.',
      category: 'general',
      status: 'open',
    },
    {
      userId: parent._id,
      subject: 'Payment not reflecting',
      description: 'Paid for Math session but still pending.',
      category: 'payment',
      status: 'in_progress',
      adminNote: 'Checking gateway logs (manual flow)',
    },
    {
      userId: tutor._id,
      subject: 'Student no-show',
      description: 'Student missed yesterday without notice.',
      category: 'tutor_dispute',
      status: 'resolved',
      adminNote: 'Marked absent; no refund',
    },
  ]);

  console.log('Messages, notifications, CMS seeded');
  console.log('Seed complete\n');
  console.log('Demo accounts (OTP:', env.demoOtp + ')');
  console.log({
    admin: '9999999999',
    tutor: '8888888888 (approved)',
    tutorPending: '8888888881 (pending verification)',
    student: '7777777777',
    parent: '6666666666',
    freeSlotId: String(freeSlot._id),
  });

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
