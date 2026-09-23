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
const { connectDb } = require('../src/config/db');
const {
  IBDP_SUBJECTS,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  ASSIGNMENT_STATUS,
  VERIFICATION_STATUS,
  RESOURCE_TYPES,
  RESOURCE_ACCESS,
  COURSE_STATUS,
  PROJECT_STATUS,
  WITHDRAWAL_STATUS,
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
const { Country, Board, ClassLevel } = require('../src/modules/catalog/catalog.model');
const {
  Wallet,
  WalletTransaction,
  Withdrawal,
  BankAccount,
} = require('../src/modules/wallet/wallet.model');
const Booking = require('../src/modules/booking/booking.model');
const SessionReport = require('../src/modules/booking/sessionReport.model');
const { Payment, SubscriptionPlan } = require('../src/modules/payment/payment.model');
const { Resource, ResourceBookmark, ResourcePurchase } = require('../src/modules/resource/resource.model');
const { Assignment, Submission } = require('../src/modules/homework/homework.model');
const { Course, CourseEnrollment } = require('../src/modules/course/course.model');
const Project = require('../src/modules/project/project.model');
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

const EXTRA_STUDENTS = [
  { name: 'Aanya Kapoor', phone: '7777777701' },
  { name: 'Rohan Mehta', phone: '7777777702' },
  { name: 'Sara Ahmed', phone: '7777777703' },
  { name: 'Liam Chen', phone: '7777777704' },
  { name: 'Priya Nair', phone: '7777777705' },
  { name: 'Omar Khalid', phone: '7777777706' },
  { name: 'Maya Iyer', phone: '7777777707' },
  { name: 'Noah Patel', phone: '7777777708' },
  { name: 'Zara Khan', phone: '7777777709' },
  { name: 'Ethan Rao', phone: '7777777710' },
  { name: 'Diya Sen', phone: '7777777711' },
  { name: 'Arjun Bose', phone: '7777777712' },
  { name: 'Leila Hassan', phone: '7777777713' },
  { name: 'Kabir Shah', phone: '7777777714' },
];

const EXTRA_TUTORS = [
  { name: 'Anika Sharma', phone: '8888888801', status: 'approved' },
  { name: 'James Whitfield', phone: '8888888802', status: 'approved' },
  { name: 'Fatima Al Hassan', phone: '8888888803', status: 'approved' },
  { name: 'Vikram Reddy', phone: '8888888804', status: 'approved' },
  { name: 'Sophie Laurent', phone: '8888888805', status: 'approved' },
  { name: 'Kenji Tanaka', phone: '8888888806', status: 'approved' },
  { name: 'Maria Santos', phone: '8888888807', status: 'approved' },
  { name: 'David Okonkwo', phone: '8888888808', status: 'approved' },
  { name: 'Elena Popov', phone: '8888888809', status: 'approved' },
  { name: 'Hassan Ibrahim', phone: '8888888810', status: 'approved' },
  { name: 'Chloe Nguyen', phone: '8888888811', status: 'pending' },
  { name: 'Rajesh Iyer', phone: '8888888812', status: 'pending' },
  { name: 'Amara Diallo', phone: '8888888813', status: 'rejected' },
  { name: 'Thomas Berg', phone: '8888888814', status: 'not_submitted' },
];

const LESSON_TITLES = [
  'Circular motion & gravity',
  'SHM past-paper drill',
  'Differentiation from first principles',
  'Chain rule workshop',
  'Stoichiometry lab recap',
  'Organic mechanisms',
  'IB Paper 2 timing',
  'Electric fields intro',
  'Integration by parts',
  'Redox titration review',
  'TOK knowledge questions',
  'Extended essay outline',
  'Vectors and planes',
  'Wave optics experiments',
];

const HW_TITLES = [
  'Past paper: SHM',
  'Integration worksheet',
  'Stoichiometry quiz',
  'Newton laws set',
  'Organic naming drill',
  'IA data table',
  'Paper 1 mixed MCQ',
  'Kinematics graphs',
  'Limits and continuity',
  'Equilibrium constants',
  'Energy transfers',
  'Complex numbers pack',
  'Spectroscopy short answers',
  'Exam timing mock',
  'Error analysis homework',
  'Revision flashcards',
];

const COURSE_TITLES = [
  'Physics HL crash course',
  'Math AA HL calculus',
  'Chemistry SL foundations',
  'IB Paper 2 bootcamp',
  'Mechanics mastery',
  'Organic chemistry sprint',
  'TOK essay clinic',
  'IA writing studio',
  'Electricity & magnetism',
  'Statistics for AI SL',
  'Biology cell biology',
  'Economics HL diagrams',
  'Computer Science OOP',
  'EE research methods',
];

const PROJECT_NAMES = [
  'Physics IA draft review',
  'Math exploration polish',
  'Chemistry IA data check',
  'TOK exhibition objects',
  'EE literature review',
  'CAS reflection pack',
  'Paper 2 essay bank',
  'Lab report rewrite',
  'Predicted grade mock',
  'University personal statement',
  'Graphing skills clinic',
  'Orgo mechanism booklet',
  'Revision timetable',
  'Oral commentary prep',
];

function phoneEmail(name, phone) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, '.')}.${phone.slice(-4)}@ibdp.demo`;
}

async function clearAll() {
  const collections = [
    Message,
    Conversation,
    Notification,
    Submission,
    Assignment,
    ResourcePurchase,
    ResourceBookmark,
    Resource,
    CourseEnrollment,
    Course,
    Project,
    Payment,
    SessionReport,
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
    BankAccount,
    Wallet,
    TutorVideo,
    ClassLevel,
    Board,
    Country,
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
    'demo-hw.pdf',
    'demo-chem.pdf',
    'demo-notes.pdf',
  ];
  for (const name of files) {
    fs.writeFileSync(path.join(uploadRoot, name), pdf);
  }
}

async function seed() {
  await connectDb();
  console.log('Connected for seed');

  await ensureDemoUploads();
  await clearAll();

  // ── Subjects + catalog ──────────────────────────────────
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
  const countries = await Country.insertMany([
    {
      name: 'India',
      code: 'IN',
      currency: 'INR',
      currencySymbol: '₹',
      defaultTimezone: 'Asia/Kolkata',
      timezones: ['Asia/Kolkata'],
    },
    {
      name: 'United Arab Emirates',
      code: 'AE',
      currency: 'AED',
      currencySymbol: 'AED',
      defaultTimezone: 'Asia/Dubai',
      timezones: ['Asia/Dubai'],
    },
    {
      name: 'United Kingdom',
      code: 'GB',
      currency: 'GBP',
      currencySymbol: '£',
      defaultTimezone: 'Europe/London',
      timezones: ['Europe/London'],
    },
    {
      name: 'United States',
      code: 'US',
      currency: 'USD',
      currencySymbol: '$',
      defaultTimezone: 'America/New_York',
      timezones: [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
      ],
    },
  ]);
  const india = countries[0];
  const uk = countries[2];
  const us = countries[3];
  const boards = await Board.insertMany([
    { name: 'IB Diploma', code: 'IBDP', isActive: true },
    { name: 'CBSE', code: 'CBSE', countryId: india._id, isActive: true },
    { name: 'ICSE', code: 'ICSE', countryId: india._id, isActive: true },
    { name: 'GCSE / A-Level', code: 'GCSE', countryId: uk._id, isActive: true },
    { name: 'AP / SAT', code: 'AP', countryId: us._id, isActive: true },
  ]);
  const classLevels = await ClassLevel.insertMany([
    { name: 'Grade 9', sortOrder: 9 },
    { name: 'Grade 10', sortOrder: 10 },
    { name: 'DP1', sortOrder: 11 },
    { name: 'DP2', sortOrder: 12 },
    { name: 'Class 11', sortOrder: 13, countryId: india._id },
    { name: 'Class 12', sortOrder: 14, countryId: india._id },
    { name: 'Year 12', sortOrder: 15, countryId: uk._id },
    { name: 'Year 13', sortOrder: 16, countryId: uk._id },
  ]);
  const ibBoard = boards[0];
  const dp2 = classLevels.find((c) => c.name === 'DP2');
  const dp1 = classLevels.find((c) => c.name === 'DP1');

  const physics = subjectDocs.find((s) => s.name === 'Physics') || subjectDocs[0];
  const math = subjectDocs.find((s) => s.name.includes('Mathematics AA HL')) || subjectDocs[1];
  const chem = subjectDocs.find((s) => s.name === 'Chemistry') || subjectDocs[2];
  const bio = subjectDocs.find((s) => s.name === 'Biology') || subjectDocs[3];
  const cs = subjectDocs.find((s) => s.name === 'Computer Science') || subjectDocs[4];
  const econ = subjectDocs.find((s) => s.name === 'Economics') || subjectDocs[5];
  const coreSubjects = [physics, math, chem, bio, cs, econ];
  console.log(`Subjects: ${subjectDocs.length}`);

  // ── Core demo users ─────────────────────────────────────
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

  await User.create({
    phone: '9999999991',
    role: 'admin',
    name: 'Ops Admin',
    email: 'ops@ibdp.demo',
    status: 'inactive',
    timezone: 'UTC',
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
    ratingCount: 12,
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

  const extraStudents = [];
  for (let i = 0; i < EXTRA_STUDENTS.length; i += 1) {
    const row = EXTRA_STUDENTS[i];
    const user = await User.create({
      phone: row.phone,
      role: 'student',
      name: row.name,
      email: phoneEmail(row.name, row.phone),
      status: i === EXTRA_STUDENTS.length - 1 ? 'inactive' : 'active',
      timezone: 'Asia/Kolkata',
      country: 'India',
    });
    await StudentProfile.create({
      userId: user._id,
      school: i % 2 === 0 ? 'Demo International School' : 'Lakeview IB Academy',
      gradeYear: i % 3 === 0 ? 'DP1' : 'DP2',
      subjectIds: [coreSubjects[i % coreSubjects.length]._id, physics._id],
      boardId: ibBoard._id,
      classLevelId: i % 3 === 0 ? dp1._id : dp2._id,
      studyStreak: (i % 7) + 1,
      lastActivityDate: dayjs()
        .subtract(i % 5, 'day')
        .format('YYYY-MM-DD'),
    });
    extraStudents.push(user);
  }

  const extraParents = [];
  for (let i = 0; i < 4; i += 1) {
    const user = await User.create({
      phone: `666666660${i + 1}`,
      role: 'parent',
      name: `Parent ${i + 1}`,
      email: `parent${i + 1}@ibdp.demo`,
      status: 'active',
      timezone: 'Asia/Kolkata',
    });
    await ParentProfile.create({ userId: user._id });
    extraParents.push(user);
  }

  const extraTutors = [];
  for (let i = 0; i < EXTRA_TUTORS.length; i += 1) {
    const row = EXTRA_TUTORS[i];
    const user = await User.create({
      phone: row.phone,
      role: 'tutor',
      name: row.name,
      email: phoneEmail(row.name, row.phone),
      status: row.status === 'rejected' ? 'suspended' : 'active',
      timezone: 'Asia/Kolkata',
      country: i % 2 === 0 ? 'India' : 'United Kingdom',
    });
    await TutorProfile.create({
      userId: user._id,
      qualifications: i % 2 === 0 ? 'IB Examiner' : 'MEd',
      university: 'Demo University',
      degree: 'MSc',
      experienceYears: 3 + (i % 8),
      languages: ['English'],
      bio: `${row.name} tutors IB ${coreSubjects[i % coreSubjects.length].name}.`,
      hourlyRate: 28 + i * 2,
      hourlyRateOnline: 28 + i * 2,
      hourlyRateOffline: 36 + i * 2,
      teachingMode: i % 2 === 0 ? 'both' : 'online',
      currency: 'USD',
      ratingAvg: 4 + (i % 10) / 10,
      ratingCount: 2 + i,
      trialLessonAvailable: i % 3 === 0,
      verificationStatus: row.status,
    });
    extraTutors.push({ user, status: row.status });
  }
  console.log(
    `Users + profiles: 1 admin + ${2 + extraTutors.length} tutors + ${1 + extraStudents.length} students + ${1 + extraParents.length} parents`
  );

  // ── Offerings (unique tutor+subject+level) ──────────────
  const offeringPayload = subjectDocs.slice(0, 14).map((subj, i) => {
    const level = subj.levels?.includes('HL') ? 'HL' : 'SL';
    const online = 38 + i;
    const offline = online + 8;
    return {
      tutorUserId: tutor._id,
      subjectId: subj._id,
      level,
      hourlyRate: online,
      onlineRate: online,
      offlineRate: offline,
      currency: 'USD',
      countryId: india._id,
      boardId: ibBoard._id,
      classLevelId: dp2._id,
    };
  });
  await TutorSubject.insertMany(offeringPayload);

  for (let i = 0; i < extraTutors.length; i += 1) {
    const subj = coreSubjects[i % coreSubjects.length];
    await TutorSubject.create({
      tutorUserId: extraTutors[i].user._id,
      subjectId: subj._id,
      level: subj.levels?.includes('HL') ? 'HL' : 'SL',
      hourlyRate: 30 + i,
      onlineRate: 30 + i,
      offlineRate: 38 + i,
      currency: 'USD',
      countryId: i % 2 === 0 ? india._id : uk._id,
      boardId: ibBoard._id,
      classLevelId: dp2._id,
    });
  }
  console.log(`Offerings: ${offeringPayload.length} for demo tutor`);

  // ── Slots ───────────────────────────────────────────────
  const slots = [];
  for (let i = 0; i < 18; i += 1) {
    const start = dayjs()
      .add(1 + Math.floor(i / 2), 'day')
      .hour(9 + (i % 7))
      .minute(0)
      .second(0)
      .millisecond(0);
    const deliveryMode = i % 2 === 0 ? 'online' : 'offline';
    const isBooked = i % 4 === 1;
    const slot = await AvailabilitySlot.create({
      tutorUserId: tutor._id,
      startAt: start.toDate(),
      endAt: start.add(1, 'hour').toDate(),
      timezone: 'Asia/Kolkata',
      deliveryMode,
      countryId: india._id,
      location:
        deliveryMode === 'offline'
          ? {
              label: 'Demo Learning Studio',
              city: 'Bengaluru',
              area: 'Indiranagar',
              address: '12, 7th Main',
            }
          : undefined,
      isBooked,
    });
    slots.push(slot);
  }
  const freeSlot = slots.find((s) => !s.isBooked);
  const bookedSlot = slots.find((s) => s.isBooked);
  console.log(`Slots: ${slots.length}`);

  await TutorVideo.insertMany([
    {
      tutorUserId: tutor._id,
      title: 'Introduction',
      kind: 'intro',
      fileUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      isActive: true,
    },
    {
      tutorUserId: tutor._id,
      title: 'Sample Physics lesson',
      kind: 'sample',
      fileUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      isActive: true,
    },
  ]);

  await TutorVerification.create({
    tutorUserId: tutor._id,
    documents: {
      identity: [{ url: '/uploads/demo-id.pdf', name: 'demo-id.pdf', status: 'approved' }],
      degree: [{ url: '/uploads/demo-degree.pdf', name: 'demo-degree.pdf', status: 'approved' }],
      certificate: [{ url: '/uploads/demo-cert.pdf', name: 'demo-cert.pdf', status: 'approved' }],
      resume: [{ url: '/uploads/demo-resume.pdf', name: 'demo-resume.pdf', status: 'approved' }],
    },
    references: [
      { name: 'Dr. Asha Rao', relation: 'Former HoD', phone: '9000000001', otpVerified: true, verifiedAt: new Date() },
      { name: 'Rahul Mehta', relation: 'Colleague', phone: '9000000002', otpVerified: true, verifiedAt: new Date() },
    ],
    notes: 'Demo approved verification',
    status: VERIFICATION_STATUS.APPROVED,
    adminNote: 'Looks good',
    submittedAt: new Date(),
    reviewedAt: new Date(),
  });

  await TutorVerification.create({
    tutorUserId: tutorPending._id,
    documents: {
      identity: [{ url: '/uploads/pending-id.pdf', name: 'pending-id.pdf' }],
      degree: [{ url: '/uploads/pending-degree.pdf', name: 'pending-degree.pdf' }],
    },
    references: [
      { name: 'Priya Nair', relation: 'Principal', phone: '9000000003', otpVerified: true, verifiedAt: new Date() },
      { name: 'Vikram Shah', relation: 'Mentor', phone: '9000000004', otpVerified: true, verifiedAt: new Date() },
    ],
    notes: 'Awaiting admin review',
    status: VERIFICATION_STATUS.PENDING,
    submittedAt: new Date(),
  });

  for (const extra of extraTutors) {
    if (extra.status === 'not_submitted') continue;
    const statusMap = {
      approved: VERIFICATION_STATUS.APPROVED,
      pending: VERIFICATION_STATUS.PENDING,
      rejected: VERIFICATION_STATUS.REJECTED,
    };
    await TutorVerification.create({
      tutorUserId: extra.user._id,
      documents: {
        identity: [{ url: '/uploads/demo-id.pdf', name: 'demo-id.pdf', status: extra.status }],
        degree: [{ url: '/uploads/demo-degree.pdf', name: 'demo-degree.pdf', status: extra.status }],
      },
      references: [
        { name: 'Ref One', relation: 'Mentor', phone: '9000000091', otpVerified: true, verifiedAt: new Date() },
        { name: 'Ref Two', relation: 'Colleague', phone: '9000000092', otpVerified: true, verifiedAt: new Date() },
      ],
      notes: `${extra.user.name} verification`,
      status: statusMap[extra.status],
      rejectReason: extra.status === 'rejected' ? 'Degree document unclear' : '',
      submittedAt: dayjs().subtract(2, 'day').toDate(),
      reviewedAt: extra.status === 'pending' ? undefined : new Date(),
    });
  }

  const allStudents = [student, ...extraStudents];
  await TutorReview.insertMany(
    allStudents.slice(0, 12).map((s, i) => ({
      tutorUserId: tutor._id,
      studentUserId: s._id,
      rating: 4 + (i % 2),
      comment: i % 2 === 0 ? 'Clear explanations and great notes.' : 'Helpful session, wants more past papers.',
    }))
  );

  await StudentNote.insertMany(
    allStudents.slice(0, 14).map((s, i) => ({
      tutorUserId: tutor._id,
      studentUserId: s._id,
      note:
        i % 3 === 0
          ? 'Strong on mechanics; needs work on electricity.'
          : i % 3 === 1
            ? 'Consistent homework; watch paper-2 timing.'
            : 'Anxious with timed mocks; keep first questions untimed.',
      tags: i % 2 === 0 ? ['follow-up', 'mechanics'] : ['timing', 'exam'],
    }))
  );
  console.log('Tutor offerings / verification / notes seeded');

  // ── Bookings ────────────────────────────────────────────
  const bookingStatuses = [
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.COMPLETED,
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.RESCHEDULED,
  ];
  const bookings = [];
  for (let i = 0; i < 18; i += 1) {
    const stu = allStudents[i % allStudents.length];
    const subj = coreSubjects[i % coreSubjects.length];
    const status = bookingStatuses[i % bookingStatuses.length];
    const slot = slots[i];
    const isPast = status === BOOKING_STATUS.COMPLETED || status === BOOKING_STATUS.CANCELLED;
    const start = isPast
      ? dayjs().subtract(2 + i, 'day').hour(15).minute(0)
      : slot
        ? dayjs(slot.startAt)
        : dayjs().add(2 + i, 'day').hour(10);
    const deliveryMode = i % 2 === 0 ? 'online' : 'offline';
    const amount = 40 + (i % 5) * 5;
    const booking = await Booking.create({
      studentUserId: stu._id,
      tutorUserId: tutor._id,
      subjectId: subj._id,
      level: subj.levels?.includes('HL') ? 'HL' : 'SL',
      slotId: slot && !isPast ? slot._id : undefined,
      startAt: start.toDate(),
      endAt: start.add(1, 'hour').toDate(),
      timezone: 'Asia/Kolkata',
      status,
      amount,
      currency: 'USD',
      notes: `${subj.name} session ${i + 1}`,
      attendance: status === BOOKING_STATUS.COMPLETED ? (i % 6 === 0 ? 'absent' : 'present') : 'pending',
      deliveryMode,
      meetingUrl: deliveryMode === 'online' ? `https://zoom.us/j/84512345${String(i).padStart(3, '0')}` : '',
      zoom:
        deliveryMode === 'online'
          ? {
              meetingId: `84512345${String(i).padStart(3, '0')}`,
              joinUrl: `https://zoom.us/j/84512345${String(i).padStart(3, '0')}`,
              startUrl: `https://zoom.us/s/84512345${String(i).padStart(3, '0')}`,
              password: `seed${String(i).padStart(2, '0')}`,
              provider: 'demo',
            }
          : undefined,
      meetingStatus:
        status === BOOKING_STATUS.COMPLETED
          ? 'ended'
          : status === BOOKING_STATUS.CANCELLED
            ? 'cancelled'
            : 'scheduled',
      completedAt: status === BOOKING_STATUS.COMPLETED ? start.add(1, 'hour').toDate() : undefined,
      bookedByUserId: i % 5 === 0 ? parent._id : stu._id,
    });
    bookings.push(booking);
  }

  const completedBookings = bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED);
  for (const booking of completedBookings.slice(0, 6)) {
    const report = await SessionReport.create({
      bookingId: booking._id,
      tutorUserId: tutor._id,
      studentUserId: booking.studentUserId,
      subjectId: booking.subjectId,
      summary: 'Covered core ideas and two past-paper questions.',
      topicsCovered: ['Concept recap', 'Past paper'],
      strengths: 'Quick with algebraic manipulation.',
      weaknesses: 'Needs more timed practice.',
      studentMood: 'engaged',
      understandingRating: 3 + (String(booking._id).charCodeAt(0) % 3),
      homeworkCompletion: 'done',
      nextSteps: 'Five warm-up questions before the next session.',
      privateNotes: 'Keep early questions untimed.',
    });
    await Booking.updateOne({ _id: booking._id }, { sessionReportId: report._id });
  }

  const bookingConfirmed = bookings.find((b) => b.status === BOOKING_STATUS.CONFIRMED);
  const bookingCompleted = completedBookings[0];

  await LessonPlan.insertMany(
    LESSON_TITLES.map((title, i) => {
      const booking = bookings[i];
      const statuses = ['draft', 'ready', 'completed'];
      return {
        tutorUserId: tutor._id,
        studentUserId: allStudents[i % allStudents.length]._id,
        subjectId: coreSubjects[i % coreSubjects.length]._id,
        title,
        objectives: `Master ${title.toLowerCase()}`,
        content: 'Warm-up → worked examples → past paper Qs',
        resources: ['formula sheet', 'markscheme'],
        scheduledFor: booking?.startAt || dayjs().add(i, 'day').toDate(),
        bookingId: booking?._id,
        status: statuses[i % 3],
      };
    })
  );
  const lessonPlans = await LessonPlan.find({ tutorUserId: tutor._id }).lean();
  console.log(`Bookings: ${bookings.length}  Lesson plans: ${lessonPlans.length}`);

  // ── Courses + enrollments ───────────────────────────────
  const courses = await Course.insertMany(
    COURSE_TITLES.map((title, i) => ({
      tutorUserId: tutor._id,
      title,
      description: `${title} — structured IB lessons with homework and past papers.`,
      subjectId: coreSubjects[i % coreSubjects.length]._id,
      level: i % 4 === 0 ? 'SL' : 'HL',
      countryId: india._id,
      price: 79 + i * 10,
      currency: 'USD',
      lessonPlanIds: lessonPlans.slice(i % 5, (i % 5) + 3).map((p) => p._id),
      status:
        i % 5 === 0 ? COURSE_STATUS.DRAFT : i === COURSE_TITLES.length - 1 ? COURSE_STATUS.ARCHIVED : COURSE_STATUS.PUBLISHED,
    }))
  );
  const publishedCourses = courses.filter((c) => c.status === COURSE_STATUS.PUBLISHED);
  const enrollments = [];
  for (let i = 0; i < 16; i += 1) {
    const course = publishedCourses[i % publishedCourses.length];
    const stu = allStudents[i % allStudents.length];
    enrollments.push({
      courseId: course._id,
      studentUserId: stu._id,
      status: i % 7 === 0 ? 'pending' : i % 11 === 0 ? 'cancelled' : 'active',
    });
  }
  const uniqueEnroll = [];
  const seenEnroll = new Set();
  for (const row of enrollments) {
    const key = `${row.courseId}:${row.studentUserId}`;
    if (seenEnroll.has(key)) continue;
    seenEnroll.add(key);
    uniqueEnroll.push(row);
  }
  await CourseEnrollment.insertMany(uniqueEnroll);
  console.log(`Courses: ${courses.length}  Enrollments: ${uniqueEnroll.length}`);

  // ── Projects ────────────────────────────────────────────
  const projectStatuses = Object.values(PROJECT_STATUS);
  const projects = await Project.insertMany(
    PROJECT_NAMES.map((name, i) => ({
      tutorUserId: tutor._id,
      studentUserId: allStudents[i % allStudents.length]._id,
      kind: i % 3 === 0 ? 'assignment' : 'project',
      name,
      description: `${name} for IB DP. Includes outline, draft, and feedback.`,
      status: projectStatuses[i % projectStatuses.length],
      price: 60 + i * 8,
      currency: 'USD',
      deliveryDate: dayjs()
        .add(i - 4, 'day')
        .hour(18)
        .toDate(),
      attachments: [{ url: '/uploads/demo-notes.pdf', name: 'brief.pdf', mimeType: 'application/pdf' }],
      deliverables:
        i % 3 === 0
          ? [{ url: '/uploads/demo-hw.pdf', name: 'deliverable.pdf', mimeType: 'application/pdf' }]
          : [],
    }))
  );
  console.log(`Projects: ${projects.length}`);

  // ── Payments + plans ────────────────────────────────────
  const plans = await SubscriptionPlan.insertMany([
    {
      name: 'Starter Pack',
      description: '4 lesson credits',
      price: 99,
      currency: 'USD',
      billingCycle: 'one_time',
      features: ['4 lessons', 'Homework support'],
      isActive: true,
    },
    {
      name: 'Monthly Unlimited',
      description: 'Unlimited tutoring within fair use',
      price: 249,
      currency: 'USD',
      billingCycle: 'monthly',
      features: ['Unlimited sessions', 'Priority booking'],
      isActive: true,
    },
    {
      name: 'Exam Sprint',
      description: '8 focused exam sessions',
      price: 179,
      currency: 'USD',
      billingCycle: 'one_time',
      features: ['8 lessons', 'Past papers'],
      isActive: true,
    },
    {
      name: 'Term Pass',
      description: 'Full term of weekly lessons',
      price: 599,
      currency: 'USD',
      billingCycle: 'yearly',
      features: ['Weekly lessons', 'IA support'],
      isActive: true,
    },
    {
      name: 'Family Plan',
      description: 'Two students, shared credits',
      price: 399,
      currency: 'USD',
      billingCycle: 'monthly',
      features: ['2 students', 'Parent reports'],
      isActive: true,
    },
    {
      name: 'Trial Pack',
      description: 'Two trial lessons',
      price: 39,
      currency: 'USD',
      billingCycle: 'one_time',
      features: ['2 trials'],
      isActive: false,
    },
    {
      name: 'IA Mentoring',
      description: 'Dedicated IA review hours',
      price: 149,
      currency: 'USD',
      billingCycle: 'one_time',
      features: ['3 review hours'],
      isActive: true,
    },
    {
      name: 'Weekend Intensive',
      description: 'Saturday crash sessions',
      price: 129,
      currency: 'USD',
      billingCycle: 'monthly',
      features: ['Weekend slots'],
      isActive: true,
    },
    {
      name: 'Parent Plus',
      description: 'Progress reports and office hours',
      price: 59,
      currency: 'USD',
      billingCycle: 'monthly',
      features: ['Weekly report'],
      isActive: true,
    },
    {
      name: 'EE Coaching',
      description: 'Extended essay checkpoints',
      price: 199,
      currency: 'USD',
      billingCycle: 'one_time',
      features: ['4 checkpoints'],
      isActive: true,
    },
    {
      name: 'HL Boost',
      description: 'HL-only problem sets',
      price: 89,
      currency: 'USD',
      billingCycle: 'one_time',
      features: ['HL problem bank'],
      isActive: true,
    },
    {
      name: 'Offline Studio',
      description: 'In-person studio hours',
      price: 219,
      currency: 'USD',
      billingCycle: 'monthly',
      features: ['Studio access'],
      isActive: true,
    },
  ]);
  const starter = plans[0];

  const payStatuses = Object.values(PAYMENT_STATUS);
  const payments = [];
  for (let i = 0; i < 16; i += 1) {
    const booking = bookings[i];
    const status = i === 0 ? PAYMENT_STATUS.AWAITING_CONFIRMATION : payStatuses[i % payStatuses.length];
    const paid = status === PAYMENT_STATUS.PAID || status === PAYMENT_STATUS.REFUNDED;
    payments.push({
      payerUserId: i % 4 === 0 ? parent._id : allStudents[i % allStudents.length]._id,
      beneficiaryUserId: tutor._id,
      bookingId: booking?._id,
      amount: booking?.amount || 45,
      currency: 'USD',
      method: 'manual',
      status,
      description: `${status.replace(/_/g, ' ')} payment for ${booking?.notes || 'lesson'}`,
      paidAt: paid ? dayjs().subtract(i, 'day').toDate() : undefined,
      adminNote: status === PAYMENT_STATUS.FAILED ? 'Card declined (demo)' : paid ? 'Confirmed' : '',
    });
  }
  payments.push({
    payerUserId: student._id,
    planId: starter._id,
    amount: 99,
    currency: 'USD',
    method: 'manual',
    status: PAYMENT_STATUS.PENDING,
    description: 'Starter Pack subscription',
  });
  payments.push({
    payerUserId: student._id,
    courseId: publishedCourses[0]._id,
    beneficiaryUserId: tutor._id,
    amount: publishedCourses[0].price,
    currency: 'USD',
    method: 'manual',
    status: PAYMENT_STATUS.PAID,
    description: `Course: ${publishedCourses[0].title}`,
    paidAt: dayjs().subtract(3, 'day').toDate(),
  });
  payments.push({
    payerUserId: extraStudents[0]._id,
    projectId: projects[0]._id,
    beneficiaryUserId: tutor._id,
    amount: projects[0].price,
    currency: 'USD',
    method: 'manual',
    status: PAYMENT_STATUS.PAID,
    description: `Project: ${projects[0].name}`,
    paidAt: dayjs().subtract(6, 'day').toDate(),
  });
  await Payment.insertMany(payments);

  const paidLessonTotal = payments
    .filter((p) => p.status === PAYMENT_STATUS.PAID && p.beneficiaryUserId)
    .reduce((sum, p) => sum + p.amount, 0);
  const tutorPayout = Math.round(paidLessonTotal * 0.75 * 100) / 100;
  const platformCut = Math.round(paidLessonTotal * 0.25 * 100) / 100;

  const tutorWallet = await Wallet.create({
    ownerType: 'user',
    ownerUserId: tutor._id,
    balance: Math.max(tutorPayout - 80, 40),
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
  for (const extra of extraStudents.slice(0, 6)) {
    await Wallet.create({
      ownerType: 'user',
      ownerUserId: extra._id,
      balance: 20 + extraStudents.indexOf(extra) * 5,
      currency: 'USD',
    });
  }
  const platformWallet = await Wallet.create({
    ownerType: 'platform',
    ownerUserId: null,
    balance: platformCut,
    currency: 'USD',
  });

  const walletTx = [];
  for (let i = 0; i < 14; i += 1) {
    const credit = i % 5 !== 0;
    const amount = credit ? 28 + i * 3 : 40;
    walletTx.push({
      walletId: tutorWallet._id,
      type: credit ? 'credit' : 'debit',
      amount,
      description: credit ? `Lesson payout ${i + 1} (75%)` : `Withdrawal ${i + 1}`,
      refType: credit ? 'payment' : 'withdrawal',
      cycle: dayjs()
        .subtract(i, 'month')
        .format('YYYY-MM'),
      availableAt: dayjs()
        .subtract(Math.max(i - 2, 0), 'day')
        .toDate(),
    });
  }
  walletTx.push({
    walletId: platformWallet._id,
    type: 'credit',
    amount: platformCut,
    description: 'Platform commission (25%)',
    refType: 'payment',
  });
  await WalletTransaction.insertMany(walletTx);

  const bank = await BankAccount.create({
    userId: tutor._id,
    holderName: 'Demo Tutor',
    last4: '4321',
    ifsc: 'HDFC0001234',
    bankName: 'HDFC Bank',
    upiId: 'demotutor@okhdfcbank',
    status: 'verified',
    verifiedAt: dayjs().subtract(20, 'day').toDate(),
  });

  await Withdrawal.insertMany([
    {
      tutorUserId: tutor._id,
      amount: 40,
      currency: 'USD',
      status: WITHDRAWAL_STATUS.APPROVED,
      adminNote: 'Paid out',
      bankAccountId: bank._id,
      cycle: dayjs().subtract(1, 'month').format('YYYY-MM'),
      payoutRef: 'PO-SEED-001',
    },
    {
      tutorUserId: tutor._id,
      amount: 55,
      currency: 'USD',
      status: WITHDRAWAL_STATUS.PENDING,
      bankAccountId: bank._id,
      cycle: dayjs().format('YYYY-MM'),
    },
    {
      tutorUserId: tutor._id,
      amount: 25,
      currency: 'USD',
      status: WITHDRAWAL_STATUS.REJECTED,
      adminNote: 'Bank details mismatch (demo)',
      bankAccountId: bank._id,
      cycle: dayjs().subtract(2, 'month').format('YYYY-MM'),
    },
  ]);
  console.log(`Plans: ${plans.length}  Payments: ${payments.length}  Wallet tx: ${walletTx.length}`);

  // ── Resources ───────────────────────────────────────────
  const topics = ['Mechanics', 'Calculus', 'Stoichiometry', 'Waves', 'Organic', 'IA'];
  const resources = await Resource.insertMany(
    Array.from({ length: 16 }, (_, i) => {
      const type = RESOURCE_TYPES[i % RESOURCE_TYPES.length];
      const paid = i % 3 === 0;
      return {
        title: `${topics[i % topics.length]} ${type.replace(/_/g, ' ')} ${i + 1}`,
        description: `Sample ${type.replace(/_/g, ' ')} for IB testing`,
        subjectId: coreSubjects[i % coreSubjects.length]._id,
        level: i % 4 === 0 ? 'SL' : 'HL',
        topic: topics[i % topics.length],
        chapter: `Ch ${(i % 8) + 1}`,
        academicYear: '2025-26',
        type,
        fileUrl: `/uploads/demo-${type}.pdf`,
        createdBy: i % 5 === 0 ? admin._id : tutor._id,
        isActive: i !== 15,
        accessType: paid ? RESOURCE_ACCESS.PAID : RESOURCE_ACCESS.FREE,
        price: paid ? 9 + i : 0,
        currency: 'USD',
        isDownloadable: true,
      };
    })
  );
  await ResourceBookmark.insertMany(
    resources.slice(0, 6).map((r) => ({
      userId: student._id,
      resourceId: r._id,
    }))
  );
  await ResourcePurchase.insertMany(
    resources
      .filter((r) => r.accessType === RESOURCE_ACCESS.PAID)
      .slice(0, 4)
      .map((r) => ({
        userId: student._id,
        resourceId: r._id,
      }))
  );

  // ── Homework ────────────────────────────────────────────
  const hwStatuses = [
    ASSIGNMENT_STATUS.ASSIGNED,
    ASSIGNMENT_STATUS.SUBMITTED,
    ASSIGNMENT_STATUS.GRADED,
    ASSIGNMENT_STATUS.OVERDUE,
  ];
  const assignments = [];
  for (let i = 0; i < HW_TITLES.length; i += 1) {
    const status = hwStatuses[i % hwStatuses.length];
    const deadline =
      status === ASSIGNMENT_STATUS.OVERDUE || status === ASSIGNMENT_STATUS.GRADED
        ? dayjs().subtract(1 + (i % 6), 'day')
        : dayjs().add(2 + (i % 8), 'day');
    const row = await Assignment.create({
      tutorUserId: tutor._id,
      studentUserId: allStudents[i % allStudents.length]._id,
      subjectId: coreSubjects[i % coreSubjects.length]._id,
      level: 'HL',
      title: HW_TITLES[i],
      description: `Complete ${HW_TITLES[i].toLowerCase()} and upload working.`,
      deadline: deadline.toDate(),
      resourceIds: [resources[i % resources.length]._id],
      rubric: 'Correct method + units',
      gradingScheme: 'ib_1_7',
      maxScore: 7,
      status,
    });
    assignments.push(row);
    if (status === ASSIGNMENT_STATUS.SUBMITTED || status === ASSIGNMENT_STATUS.GRADED) {
      await Submission.create({
        assignmentId: row._id,
        studentUserId: row.studentUserId,
        files: ['/uploads/demo-hw.pdf'],
        notes: 'Attempted all questions',
        grade: status === ASSIGNMENT_STATUS.GRADED ? String(5 + (i % 3)) : '',
        feedback: status === ASSIGNMENT_STATUS.GRADED ? 'Solid method; watch significant figures.' : '',
        gradedAt: status === ASSIGNMENT_STATUS.GRADED ? new Date() : undefined,
        versionHistory: [
          {
            files: ['/uploads/demo-hw.pdf'],
            notes: 'Attempted all questions',
            submittedAt: dayjs().subtract(1, 'day').toDate(),
          },
        ],
      });
    }
  }
  const assignmentOpen = assignments.find((a) => a.status === ASSIGNMENT_STATUS.ASSIGNED);
  console.log(`Resources: ${resources.length}  Homework: ${assignments.length}`);

  // ── Progress + badges ───────────────────────────────────
  const badges = await Badge.insertMany([
    { name: 'First Submission', description: 'Submitted first homework', criteria: 'Complete 1 homework', icon: 'star', isActive: true },
    { name: 'Study Streak 3', description: 'Studied 3 days in a row', criteria: '3-day streak', isActive: true },
    { name: 'Past Paper Pro', description: 'Finished 5 past papers', criteria: '5 papers', isActive: true },
    { name: 'IA Starter', description: 'Uploaded IA outline', criteria: 'IA outline', isActive: true },
    { name: 'Perfect 7', description: 'Scored 7 on a graded assignment', criteria: 'Grade 7', isActive: true },
    { name: 'On Time', description: 'Submitted before deadline 4 times', criteria: '4 on-time', isActive: true },
    { name: 'Night Owl', description: 'Completed a weekend mock', criteria: 'Weekend mock', isActive: true },
    { name: 'Peer Helper', description: 'Shared notes with a classmate', criteria: 'Share notes', isActive: false },
  ]);
  await StudentBadge.insertMany(
    badges.slice(0, 6).map((b, i) => ({
      studentUserId: allStudents[i % allStudents.length]._id,
      badgeId: b._id,
    }))
  );
  await ProgressRecord.insertMany(
    allStudents.slice(0, 12).map((s, i) => ({
      studentUserId: s._id,
      subjectId: coreSubjects[i % coreSubjects.length]._id,
      topic: topics[i % topics.length],
      metricType: i % 2 === 0 ? 'homework' : 'hours',
      scoreLabel: 'grade',
      scoreValue: 4 + (i % 4),
      hours: 1 + (i % 5),
    }))
  );

  await ParentStudentLink.insertMany([
    { parentUserId: parent._id, studentUserId: student._id, relationship: 'parent', status: 'active' },
    { parentUserId: parent._id, studentUserId: extraStudents[0]._id, relationship: 'parent', status: 'active' },
    { parentUserId: parent._id, studentUserId: extraStudents[1]._id, relationship: 'guardian', status: 'active' },
    { parentUserId: extraParents[0]._id, studentUserId: extraStudents[2]._id, relationship: 'parent', status: 'active' },
    { parentUserId: extraParents[1]._id, studentUserId: extraStudents[3]._id, relationship: 'parent', status: 'pending' },
  ]);

  // ── Messages ────────────────────────────────────────────
  const convoStudent = await Conversation.create({
    participants: [student._id, tutor._id],
    lastMessageAt: new Date(),
  });
  await Message.insertMany([
    {
      conversationId: convoStudent._id,
      senderId: student._id,
      body: 'Hi! Can we focus on past papers tomorrow?',
      readBy: [student._id, tutor._id],
    },
    {
      conversationId: convoStudent._id,
      senderId: tutor._id,
      body: 'Absolutely — bring May 2023 TZ1.',
      readBy: [tutor._id],
    },
    {
      conversationId: convoStudent._id,
      senderId: student._id,
      body: 'Also stuck on chain rule Q4.',
      readBy: [student._id],
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
  for (let i = 0; i < 8; i += 1) {
    const stu = extraStudents[i];
    const convo = await Conversation.create({
      participants: [stu._id, tutor._id],
      lastMessageAt: dayjs().subtract(i, 'hour').toDate(),
    });
    await Message.insertMany([
      {
        conversationId: convo._id,
        senderId: stu._id,
        body: `Hello, can we review ${coreSubjects[i % coreSubjects.length].name} this week?`,
        readBy: [stu._id],
      },
      {
        conversationId: convo._id,
        senderId: tutor._id,
        body: 'Yes — I will send a slot shortly.',
        readBy: [tutor._id, stu._id],
      },
    ]);
  }

  // ── Notifications ───────────────────────────────────────
  const notifTypes = ['booking', 'homework', 'payment', 'verification', 'message', 'system'];
  const tutorNotifs = Array.from({ length: 16 }, (_, i) => ({
    userId: tutor._id,
    title: [
      'New booking',
      'Homework submitted',
      'Payout credited',
      'Student message',
      'Withdrawal update',
      'Session reminder',
    ][i % 6],
    body: `Demo notification ${i + 1} for the tutor inbox.`,
    type: notifTypes[i % notifTypes.length],
    isRead: i % 3 === 0,
  }));
  const otherNotifs = [
    {
      userId: student._id,
      title: 'Booking confirmed',
      body: 'Your Physics session is confirmed.',
      type: 'booking',
      meta: { bookingId: bookingConfirmed?._id },
      isRead: false,
    },
    {
      userId: student._id,
      title: 'New homework',
      body: assignmentOpen?.title || 'New homework assigned',
      type: 'homework',
      isRead: false,
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
  ];
  await Notification.insertMany([...tutorNotifs, ...otherNotifs]);

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
    {
      title: 'Tutor payout window',
      body: 'Withdrawals open on the last three days of each month.',
      audience: 'tutor',
      isActive: true,
      createdBy: admin._id,
    },
    {
      title: 'Parent progress reports',
      body: 'Weekly summaries now include attendance and homework.',
      audience: 'parent',
      isActive: true,
      createdBy: admin._id,
    },
    {
      title: 'Holiday schedule',
      body: 'Limited slots over the mid-term break. Book early.',
      audience: 'all',
      isActive: true,
      createdBy: admin._id,
    },
    {
      title: 'New IA resources',
      body: 'Formula sheets and markschemes added to the library.',
      audience: 'student',
      isActive: true,
      createdBy: admin._id,
    },
    {
      title: 'Verification SLA',
      body: 'Admin review target is two working days.',
      audience: 'tutor',
      isActive: true,
      createdBy: admin._id,
    },
    {
      title: 'Offline studio hours',
      body: 'Bengaluru studio open Sat 10–16.',
      audience: 'all',
      isActive: true,
      createdBy: admin._id,
    },
    {
      title: 'Ops: refund policy',
      body: 'No-shows are not refunded after 12h notice.',
      audience: 'admin',
      isActive: true,
      createdBy: admin._id,
    },
    {
      title: 'CAS reminder',
      body: 'Log reflections before the term checkpoint.',
      audience: 'student',
      isActive: false,
      createdBy: admin._id,
    },
    {
      title: 'Currency note',
      body: 'Demo wallets use USD for payouts.',
      audience: 'tutor',
      isActive: true,
      createdBy: admin._id,
    },
    {
      title: 'Support hours',
      body: 'Tickets answered 9–18 IST on weekdays.',
      audience: 'all',
      isActive: true,
      createdBy: admin._id,
    },
  ]);

  const campaignChannels = ['organic', 'paid_search', 'social', 'referral', 'email', 'events'];
  await CampaignMetric.insertMany(
    Array.from({ length: 12 }, (_, i) => ({
      name: `Campaign ${i + 1} ${campaignChannels[i % campaignChannels.length]}`,
      channel: campaignChannels[i % campaignChannels.length],
      spend: i * 80,
      leads: 12 + i * 7,
      conversions: 3 + i * 2,
      notes: 'Admin-fed demo campaign',
      periodStart: dayjs()
        .subtract(30 - i * 2, 'day')
        .toDate(),
      periodEnd: dayjs()
        .subtract(16 - i * 2, 'day')
        .toDate(),
      createdBy: admin._id,
    }))
  );

  await PlatformConfig.insertMany([
    { key: 'analytics.widgets', value: ['usersByRole', 'revenue', 'bookings', 'campaigns'], description: 'Enabled analytics widgets' },
    { key: 'supportEmail', value: 'support@ibdp.demo', description: 'Public support contact' },
    { key: 'booking.minHoursNotice', value: 12, description: 'Minimum hours before booking start' },
    { key: 'withdraw_window_start_day', value: 29, description: 'First calendar day of the month when tutors may withdraw' },
    { key: 'withdraw_window_end_day', value: 31, description: 'Last calendar day of the month when tutors may withdraw' },
    { key: 'payout.tutorRate', value: 0.75, description: 'Tutor share of paid lessons' },
    { key: 'payout.platformRate', value: 0.25, description: 'Platform commission' },
    { key: 'booking.defaultCurrency', value: 'USD', description: 'Default listing currency' },
    { key: 'otp.length', value: 6, description: 'OTP digit length' },
    { key: 'marketplace.pageSize', value: 12, description: 'Tutor search page size' },
    { key: 'homework.defaultScheme', value: 'ib_1_7', description: 'Default grading scheme' },
    { key: 'feature.projects', value: true, description: 'Projects module enabled' },
  ]);

  const ticketCats = ['general', 'booking', 'payment', 'tutor_dispute', 'complaint'];
  const ticketStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  await SupportTicket.insertMany(
    Array.from({ length: 14 }, (_, i) => {
      const owner =
        i % 4 === 0 ? parent._id : i % 3 === 0 ? tutor._id : allStudents[i % allStudents.length]._id;
      return {
        userId: owner,
        subject: [
          'Cannot upload homework',
          'Payment not reflecting',
          'Student no-show',
          'Zoom link missing',
          'Wrong subject on booking',
          'Refund request',
          'Slot disappeared',
          'Grade not showing',
          'Parent cannot see child',
          'Resource download failed',
          'Verification stuck',
          'Wallet balance mismatch',
          'Reschedule declined',
          'App crash on calendar',
        ][i],
        description: 'Demo support ticket for admin list pagination and filters.',
        category: ticketCats[i % ticketCats.length],
        status: ticketStatuses[i % ticketStatuses.length],
        adminNote: i % 3 === 0 ? 'Checking logs (demo)' : '',
      };
    })
  );

  console.log('Messages, notifications, CMS seeded');
  console.log('Seed complete\n');
  console.log('Demo accounts (OTP:', env.demoOtp + ')');
  console.log({
    admin: '9999999999',
    tutor: '8888888888 (approved)',
    tutorPending: '8888888881 (pending verification)',
    student: '7777777777',
    parent: '6666666666',
    extraStudents: EXTRA_STUDENTS.length,
    extraTutors: EXTRA_TUTORS.length,
    offerings: offeringPayload.length,
    slots: slots.length,
    bookings: bookings.length,
    courses: courses.length,
    projects: projects.length,
    homework: assignments.length,
    resources: resources.length,
    freeSlotId: String(freeSlot?._id || ''),
    bookedSlotId: String(bookedSlot?._id || ''),
    completedBookingId: String(bookingCompleted?._id || ''),
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
