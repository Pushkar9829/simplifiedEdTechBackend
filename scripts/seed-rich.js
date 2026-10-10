/**
 * Rich demo seed — runs the base seed (scripts/seed.js) first, then layers a large, realistic,
 * deterministic data set on top so every screen state of the UI can be seen and polished.
 *
 * Run (LOCAL DB ONLY — the script refuses any non-localhost Mongo host and any S3 config):
 *   MONGODB_URI="mongodb://127.0.0.1:27017/edtech_audit" AWS_REGION= S3_REGION= S3_BUCKET= \
 *   AWS_S3_BUCKET_NAME= AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY= CLOUDFRONT_DOMAIN= \
 *   S3_PUBLIC_BASE_URL= UPLOAD_DIR=<local uploads dir> npm run seed:rich
 *
 * Demo logins (OTP 123456): admin 9999999999 | tutor 8888888888 | student 7777777777 | parent 6666666666
 * Empty-state logins: student 7777700000 | parent 6666600000 | tutor (no slots) 8888800000
 *
 * Time-relative data ("starting in 10 min", "in progress") is anchored to the moment the seed runs;
 * re-run the seed to refresh those states.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const env = require('../src/config/env');

// ── Safety guard ──────────────────────────────────────────────────────────────
const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];
const S3_ENV_KEYS = [
  'AWS_REGION',
  'S3_REGION',
  'S3_BUCKET',
  'AWS_S3_BUCKET_NAME',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'CLOUDFRONT_DOMAIN',
  'S3_PUBLIC_BASE_URL',
];

function assertLocalOnly() {
  const uri = String(env.mongoUri || '');
  const m = uri.match(/^([a-z+]+):\/\/(?:[^@/]*@)?([^/?]+)/i);
  if (!m) throw new Error('[seed-rich] Refusing to run: MONGODB_URI could not be parsed');
  if (m[1].toLowerCase() !== 'mongodb') {
    throw new Error(`[seed-rich] Refusing to run: only mongodb:// URIs on localhost are allowed (got ${m[1]}://)`);
  }
  const hosts = m[2]
    .split(',')
    .map((h) => h.trim().replace(/:\d+$/, '').toLowerCase())
    .filter(Boolean);
  if (!hosts.length || !hosts.every((h) => LOCAL_HOSTS.includes(h))) {
    throw new Error(
      `[seed-rich] Refusing to run: Mongo host(s) "${hosts.join(',')}" are not 127.0.0.1/localhost`
    );
  }
  const s3 = env.s3 || {};
  const setKeys = S3_ENV_KEYS.filter((k) => process.env[k]);
  if (setKeys.length || s3.region || s3.bucket || s3.accessKeyId || s3.secretAccessKey || s3.publicBaseUrl) {
    throw new Error(
      `[seed-rich] Refusing to run: S3 is configured (${setKeys.join(', ') || 'env.s3'}). Blank every S3/AWS var.`
    );
  }
  return hosts;
}

// ── Deterministic PRNG ────────────────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261008);
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const money = (n) => Math.round(Number(n || 0) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
const digits = (n) => Array.from({ length: n }, () => int(0, 9)).join('');

async function main() {
  const hosts = assertLocalOnly();
  console.log(`[seed-rich] Target DB: ${env.mongoUri} (hosts: ${hosts.join(',')}) — S3 disabled`);

  // 1) Base seed in a child process (it wipes + recreates the base demo set and disconnects).
  console.log('[seed-rich] Running base seed (scripts/seed.js)…');
  const base = spawnSync(process.execPath, [path.join(__dirname, 'seed.js')], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.resolve(__dirname, '..'),
  });
  if (base.status !== 0) throw new Error(`[seed-rich] Base seed failed (exit ${base.status})`);
  assertLocalOnly();
  console.log('\n[seed-rich] Base seed complete — adding rich data…');

  await rich();
}

async function rich() {
  const mongoose = require('mongoose');
  const { dayjs } = require('../src/utils/time');
  const { connectDb } = require('../src/config/db');
  const { makeRefCode } = require('../src/utils/refCode');
  const { classToolsFor, classToolsMessage } = require('../src/utils/classTools');
  const { normalizeGrade } = require('../src/utils/grading');
  const { RESOURCE_TYPES } = require('../src/common/constants');

  const User = require('../src/modules/user/user.model');
  const UserBlock = require('../src/modules/user/block.model');
  const { StudentProfile, TutorProfile, ParentProfile } = require('../src/modules/user/profile.model');
  const Subject = require('../src/modules/subject/subject.model');
  const {
    TutorSubject,
    AvailabilitySlot,
    TutorVerification,
    TutorReview,
    StudentNote,
    LessonPlan,
    TutorVideo,
    FavoriteTutor,
  } = require('../src/modules/tutor/tutor.model');
  const { Country, Board, ClassLevel, LookupOption } = require('../src/modules/catalog/catalog.model');
  const { Wallet, WalletTransaction, Withdrawal, BankAccount } = require('../src/modules/wallet/wallet.model');
  const Booking = require('../src/modules/booking/booking.model');
  const ScheduleChange = require('../src/modules/booking/scheduleChange.model');
  const SessionReport = require('../src/modules/booking/sessionReport.model');
  const { Payment, SubscriptionPlan } = require('../src/modules/payment/payment.model');
  const {
    Resource,
    ResourceBookmark,
    ResourcePurchase,
    ResourceSuggestion,
    ResourceReview,
  } = require('../src/modules/resource/resource.model');
  const { Assignment, Submission } = require('../src/modules/homework/homework.model');
  const { Course, CourseEnrollment } = require('../src/modules/course/course.model');
  const Project = require('../src/modules/project/project.model');
  const { ProgressRecord, Badge, StudentBadge } = require('../src/modules/progress/progress.model');
  const ParentStudentLink = require('../src/modules/parent/parent.model');
  const { Conversation, Message } = require('../src/modules/message/message.model');
  const Notification = require('../src/modules/notification/notification.model');
  const FavoriteItem = require('../src/modules/favorite/favorite.model');
  const { Announcement, CampaignMetric, PlatformConfig, SupportTicket } = require('../src/modules/cms/cms.model');

  await connectDb();
  const NOW = Date.now();
  const oid = () => new mongoose.Types.ObjectId();
  const sid = (x) => String(x?._id || x);
  const ago = (days, hours = 0, mins = 0) => new Date(NOW - days * 864e5 - hours * 36e5 - mins * 6e4);
  const fromNow = (days, hours = 0, mins = 0) => new Date(NOW + days * 864e5 + hours * 36e5 + mins * 6e4);
  const minDate = (...ds) => new Date(Math.min(...ds.map((d) => +d)));

  // Wall-clock time in a timezone, `dayOffset` days from today (works for past offsets too).
  function atTz(tz, dayOffset, h, m = 0) {
    const date = dayjs().tz(tz).add(dayOffset, 'day').format('YYYY-MM-DD');
    return dayjs.tz(`${date} ${pad(h)}:${pad(m)}`, tz).toDate();
  }
  const IST = 'Asia/Kolkata';
  const ist = (d, h, m = 0) => atTz(IST, d, h, m);
  const roundUp5 = (date) => new Date(Math.ceil(+date / 3e5) * 3e5);

  // Insert via the raw driver after full Mongoose validation/casting, so createdAt/updatedAt
  // can be back-dated precisely (Mongoose timestamps would otherwise overwrite updatedAt).
  async function put(Model, rows) {
    if (!rows.length) return [];
    const docs = [];
    for (const r of rows) {
      const { createdAt, updatedAt, ...rest } = r;
      const d = new Model(rest);
      try {
        await d.validate();
      } catch (err) {
        throw new Error(`[seed-rich] ${Model.modelName} validation: ${err.message}`);
      }
      const o = d.toObject({ virtuals: false, getters: false, flattenMaps: true, depopulate: true, transform: false });
      delete o.id;
      o.createdAt = createdAt || new Date(NOW);
      o.updatedAt = updatedAt || o.createdAt;
      if (o.__v === undefined) o.__v = 0;
      docs.push(o);
    }
    await Model.collection.insertMany(docs, { ordered: true });
    return docs;
  }

  // ── Demo files on local disk (served from /uploads) ───────────────────────
  const files = new Set();
  const file = (name) => {
    files.add(name);
    return `/uploads/${name}`;
  };
  const pdfAtt = (name, size = 0) => ({
    url: file(name),
    name,
    mimeType: 'application/pdf',
    size: size || int(80, 2400) * 1024,
  });
  const imgAtt = (name) => ({ url: file(name), name, mimeType: 'image/png', size: int(200, 3200) * 1024 });

  // ── Load base data ─────────────────────────────────────────────────────────
  await FavoriteItem.deleteMany({});
  await UserBlock.deleteMany({});

  const subjects = await Subject.find().lean();
  const SUBJ = (name) => {
    const s = subjects.find((x) => x.name === name);
    if (!s) throw new Error(`Subject missing: ${name}`);
    return s;
  };
  const levelOf = (s) => (s.levels?.includes('HL') ? 'HL' : s.levels?.[0] || 'N/A');
  const phys = SUBJ('Physics');
  const chem = SUBJ('Chemistry');
  const bio = SUBJ('Biology');
  const mathAA = SUBJ('Mathematics AA HL');
  const econ = SUBJ('Economics');
  const tok = SUBJ('Theory of Knowledge (TOK)');
  const ee = SUBJ('Extended Essay (EE)');
  const cs = SUBJ('Computer Science');
  const engB = SUBJ('English B');

  const byPhone = async (phone) => {
    const u = await User.findOne({ phone }).lean();
    if (!u) throw new Error(`Base user missing: ${phone}`);
    return u;
  };
  const admin = await byPhone('9999999999');
  const T = await byPhone('8888888888');
  const S = await byPhone('7777777777');
  const P = await byPhone('6666666666');
  const A = await byPhone('7777777701'); // Aanya Kapoor — demo parent's child
  const R = await byPhone('7777777702'); // Rohan Mehta — demo parent's child
  const baseStudents = await User.find({ role: 'student', phone: /^77777777/ }).lean();
  const baseExtraStudents = baseStudents.filter((u) => u.phone !== S.phone);
  const baseTutors = await User.find({ role: 'tutor' }).lean();
  const stuByPhone = (p) => baseStudents.find((u) => u.phone === p);
  const Sara = stuByPhone('7777777703');
  const Liam = stuByPhone('7777777704');
  const Priya = stuByPhone('7777777705');
  const Omar = stuByPhone('7777777706');
  const Maya = stuByPhone('7777777707');
  const Noah = stuByPhone('7777777708');
  const Anika = baseTutors.find((u) => u.phone === '8888888801');
  const James = baseTutors.find((u) => u.phone === '8888888802');
  const usedRefCodes = new Set((await User.find({}, 'refCode').lean()).map((u) => u.refCode).filter(Boolean));
  const refFor = (id) => {
    let code = makeRefCode(id);
    for (let i = 1; usedRefCodes.has(code); i += 1) code = makeRefCode(id, i);
    usedRefCodes.add(code);
    return code;
  };

  // ── Catalog additions ──────────────────────────────────────────────────────
  const newCountries = await put(Country, [
    { name: 'Singapore', code: 'SG', currency: 'SGD', currencySymbol: 'S$', defaultTimezone: 'Asia/Singapore', timezones: ['Asia/Singapore'] },
    { name: 'Switzerland', code: 'CH', currency: 'CHF', currencySymbol: 'CHF', defaultTimezone: 'Europe/Zurich', timezones: ['Europe/Zurich'] },
    { name: 'Hong Kong', code: 'HK', currency: 'HKD', currencySymbol: 'HK$', defaultTimezone: 'Asia/Hong_Kong', timezones: ['Asia/Hong_Kong'] },
    { name: 'Netherlands', code: 'NL', currency: 'EUR', currencySymbol: '€', defaultTimezone: 'Europe/Amsterdam', timezones: ['Europe/Amsterdam'] },
    { name: 'Germany', code: 'DE', currency: 'EUR', currencySymbol: '€', defaultTimezone: 'Europe/Berlin', timezones: ['Europe/Berlin'] },
    { name: 'Kenya', code: 'KE', currency: 'KES', currencySymbol: 'KSh', defaultTimezone: 'Africa/Nairobi', timezones: ['Africa/Nairobi'], isActive: false },
  ]);
  const countries = await Country.find().lean();
  const countryByName = Object.fromEntries(countries.map((c) => [c.name, c]));
  await put(Board, [
    { name: 'IB Middle Years (MYP)', code: 'IBMYP', isActive: true },
    { name: 'Cambridge IGCSE', code: 'IGCSE', countryId: countryByName['United Kingdom']._id, isActive: true },
    { name: 'Singapore A-Level', code: 'SGAL', countryId: countryByName.Singapore._id, isActive: true },
    { name: 'Swiss Matura', code: 'MATU', countryId: countryByName.Switzerland._id, isActive: false },
  ]);
  await put(ClassLevel, [
    { name: 'MYP 5', sortOrder: 8 },
    { name: 'Grade 11', sortOrder: 17 },
    { name: 'Grade 12', sortOrder: 18 },
    { name: 'Gap year', sortOrder: 30, isActive: false },
  ]);
  const ibBoard = await Board.findOne({ code: 'IBDP' }).lean();
  const dp1 = await ClassLevel.findOne({ name: 'DP1' }).lean();
  const dp2 = await ClassLevel.findOne({ name: 'DP2' }).lean();
  const extraLookups = [
    ['language', 'ta', 'Tamil', 8],
    ['language', 'ja', 'Japanese', 9],
    ['language', 'nl', 'Dutch', 10],
    ['language', 'kn', 'Kannada', 11],
    ['ticket_category', 'technical', 'Technical issue', 6],
    ['ticket_category', 'verification', 'Tutor verification', 7],
    ['ticket_category', 'refund', 'Refund', 8],
    ['campaign_channel', 'events', 'School events', 8],
    ['subject_category', 'test_prep', 'Test prep (SAT/IELTS)', 4],
    ['resource_type', 'video_lesson', 'Video lesson (beta)', 9],
  ];
  for (const [group, value, label, sortOrder] of extraLookups) {
    await LookupOption.updateOne(
      { group, value },
      { $setOnInsert: { group, value, label, sortOrder, isActive: !(group === 'resource_type'), meta: {} } },
      { upsert: true }
    );
  }
  console.log(`Catalog: +${newCountries.length} countries, +4 boards, +4 class levels, +${extraLookups.length} lookups`);

  // ── Cities / currencies ────────────────────────────────────────────────────
  const CITY = {
    Bengaluru: { country: 'India', cur: 'INR', tz: 'Asia/Kolkata', state: 'Karnataka', areas: ['Indiranagar', 'Koramangala', 'Whitefield', 'HSR Layout', 'Jayanagar'], lat: 12.9716, lng: 77.5946, wa: '+91 98450' },
    Mumbai: { country: 'India', cur: 'INR', tz: 'Asia/Kolkata', state: 'Maharashtra', areas: ['Bandra West', 'Powai', 'Juhu', 'Lower Parel', 'Andheri East'], lat: 19.076, lng: 72.8777, wa: '+91 98200' },
    Dubai: { country: 'United Arab Emirates', cur: 'AED', tz: 'Asia/Dubai', state: 'Dubai', areas: ['Jumeirah', 'Dubai Marina', 'Al Barsha', 'Downtown', 'Mirdif'], lat: 25.2048, lng: 55.2708, wa: '+971 50' },
    Singapore: { country: 'Singapore', cur: 'SGD', tz: 'Asia/Singapore', state: 'Singapore', areas: ['Bukit Timah', 'Tanglin', 'Novena', 'Tampines'], lat: 1.3521, lng: 103.8198, wa: '+65 9' },
    London: { country: 'United Kingdom', cur: 'GBP', tz: 'Europe/London', state: 'England', areas: ['Kensington', 'Hampstead', 'Richmond', 'Canary Wharf'], lat: 51.5072, lng: -0.1276, wa: '+44 7700' },
    Geneva: { country: 'Switzerland', cur: 'CHF', tz: 'Europe/Zurich', state: 'Geneva', areas: ['Champel', 'Eaux-Vives', 'Plainpalais'], lat: 46.2044, lng: 6.1432, wa: '+41 79' },
    'Hong Kong': { country: 'Hong Kong', cur: 'HKD', tz: 'Asia/Hong_Kong', state: 'Hong Kong Island', areas: ['Mid-Levels', 'Pok Fu Lam', 'Sai Kung', 'Kowloon Tong'], lat: 22.3193, lng: 114.1694, wa: '+852 9' },
    Amsterdam: { country: 'Netherlands', cur: 'EUR', tz: 'Europe/Amsterdam', state: 'North Holland', areas: ['Zuid', 'De Pijp', 'Jordaan'], lat: 52.3676, lng: 4.9041, wa: '+31 6' },
    'New York': { country: 'United States', cur: 'USD', tz: 'America/New_York', state: 'NY', areas: ['Upper West Side', 'Brooklyn Heights', 'Tribeca'], lat: 40.7128, lng: -74.006, wa: '+1 917' },
  };
  const FX = { USD: 1, INR: 83, AED: 3.67, GBP: 0.79, SGD: 1.35, EUR: 0.92, CHF: 0.88, HKD: 7.8 };
  const priceIn = (cur, usd) => {
    const v = usd * (FX[cur] || 1);
    if (cur === 'INR') return Math.round(v / 100) * 100;
    if (cur === 'HKD') return Math.round(v / 10) * 10;
    return Math.round(v);
  };
  const phoneEmail = (name, phone) => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}.${phone.slice(-4)}@ibdp.demo`;
  const address = (cityName, label = 'Home') => {
    const c = CITY[cityName];
    const area = pick(c.areas);
    return {
      label,
      line1: `${int(2, 220)}, ${pick(['Palm Grove', 'Lakeview Residency', 'Cedar Court', 'Harbour View', 'Maple Heights', 'Rosewood Apartments'])}`,
      line2: `${pick(['Tower B', 'Flat 1203', 'Block C', 'Unit 7', 'Apt 4A'])}`,
      area,
      city: cityName,
      state: c.state,
      postalCode: digits(6),
      country: c.country,
      landmark: pick(['Near the metro station', 'Opposite the community park', 'Behind the international school', '']),
      lat: money(c.lat + (rand() - 0.5) / 20) ,
      lng: money(c.lng + (rand() - 0.5) / 20),
    };
  };

  // ── New users ──────────────────────────────────────────────────────────────
  const userRows = [];
  const studentProfiles = [];
  const tutorProfiles = [];
  const parentProfiles = [];
  function mkUser({ phone, role, name, city, status = 'active', blacklistReason = '', email, createdDaysAgo, dob, sex }) {
    const c = CITY[city] || CITY.Bengaluru;
    const country = countryByName[c.country];
    const _id = oid();
    const row = {
      _id,
      phone,
      role,
      name,
      email: email || phoneEmail(name, phone),
      timezone: c.tz,
      country: c.country,
      countryId: country?._id,
      preferredCurrency: c.cur,
      dateOfBirth: dob,
      sex: sex || '',
      blacklistReason,
      refCode: refFor(_id),
      status,
      lastLoginAt: status === 'active' ? ago(int(0, 6), int(0, 20)) : ago(int(30, 90)),
      createdAt: ago(createdDaysAgo ?? int(20, 200)),
    };
    userRows.push(row);
    return row;
  }

  const SCHOOLS = {
    Bengaluru: ['The International School Bangalore (TISB)', 'Canadian International School Bengaluru', 'Stonehill International School'],
    Mumbai: ['Dhirubhai Ambani International School', 'Oberoi International School', 'Ecole Mondiale World School'],
    Dubai: ['GEMS World Academy Dubai', 'Dubai College', 'Jumeira Baccalaureate School'],
    Singapore: ['United World College South East Asia', 'Tanglin Trust School', 'ACS (International) Singapore'],
    London: ['Southbank International School', 'King\'s College School Wimbledon', 'ACS Hillingdon'],
    Geneva: ['International School of Geneva (Ecolint)', 'Collège du Léman', 'Institut Florimont'],
    'Hong Kong': ['Chinese International School', 'Hong Kong International School', 'Li Po Chun UWC'],
    Amsterdam: ['Amsterdam International Community School', 'International School of Amsterdam'],
    'New York': ['United Nations International School', 'Dwight School'],
  };
  const STUDENT_SUBJECT_SETS = [
    ['Physics', 'Mathematics AA HL', 'Chemistry', 'Economics', 'English B', 'Theory of Knowledge (TOK)'],
    ['Biology', 'Chemistry', 'Mathematics AA SL', 'Psychology', 'Language A Literature', 'Extended Essay (EE)'],
    ['Economics', 'Business Management', 'Mathematics AI SL', 'Geography', 'English B', 'Theory of Knowledge (TOK)'],
    ['Computer Science', 'Mathematics AA HL', 'Physics', 'French', 'Language A Language & Literature', 'Extended Essay (EE)'],
    ['History', 'Global Politics', 'Mathematics AI SL', 'Environmental Systems', 'Spanish', 'Theory of Knowledge (TOK)'],
  ];

  const NEW_STUDENTS = [
    ['Ishaan Malhotra', 'Mumbai'],
    ['Ananya Krishnan', 'Bengaluru'],
    ['Yusuf Al-Mansoori', 'Dubai'],
    ['Mei Ling Tan', 'Singapore'],
    ['Oliver Bennett', 'London'],
    ['Camille Dubois', 'Geneva'],
    ['Ethan Wong', 'Hong Kong'],
    ['Sanne de Vries', 'Amsterdam'],
    ['Aarav Gupta', 'Bengaluru'],
    ['Noor Haddad', 'Dubai'],
    ['Riya Deshpande', 'Mumbai'],
    ['Lucas Müller', 'Geneva'],
    ['Hannah Lee', 'Singapore'],
    ['Arjun Venkataraman', 'Bengaluru'],
    ['Amelia Clarke', 'London'],
    ['Rafael Costa', 'Dubai'],
    ['Kavya Reddy', 'Bengaluru'],
    ['Jun Hao Lim', 'Singapore'],
    ['Sofia Rossi', 'Geneva'],
    ['Chloe Chan', 'Hong Kong'],
    ['Vihaan Joshi', 'Mumbai', 'suspended'],
    ['Aisha Rahman', 'London', 'blacklisted', 'Repeatedly shared personal contact details and abusive messages with tutors (3 reports).'],
    ['Tobias Schneider', 'Amsterdam', 'inactive'],
    ['Siddharth Narayanaswamy Iyengar-Ramachandran', 'Bengaluru'],
    ['Zoe Papadopoulos', 'Dubai'],
  ];
  const newStudents = NEW_STUDENTS.map(([name, city, status, reason], i) => {
    const u = mkUser({
      phone: `77777710${pad(i + 1)}`,
      role: 'student',
      name,
      city,
      status,
      blacklistReason: reason || '',
      dob: new Date(Date.UTC(2008 + (i % 3), i % 12, 3 + i)),
      sex: i % 2 ? 'female' : 'male',
    });
    const set = STUDENT_SUBJECT_SETS[i % STUDENT_SUBJECT_SETS.length].map(SUBJ);
    const isDp1 = i % 3 === 0;
    studentProfiles.push({
      userId: u._id,
      school: pick(SCHOOLS[city]),
      gradeYear: isDp1 ? 'DP1' : 'DP2',
      subjectIds: set.map((s) => s._id),
      boardId: ibBoard._id,
      classLevelId: isDp1 ? dp1._id : dp2._id,
      studyStreak: int(0, 21),
      lastActivityDate: dayjs(ago(int(0, 9))).format('YYYY-MM-DD'),
      predictedGrades: Object.fromEntries(set.slice(0, 5).map((s) => [String(s._id), String(int(4, 7))])),
      dateOfBirth: u.dateOfBirth,
      sex: u.sex,
      preferredCurrency: CITY[city].cur,
      whatsappNumber: `${CITY[city].wa}${digits(5)}`,
      addresses: [address(city)],
      emergencyContact: { name: `${name.split(' ')[0]}'s parent`, relationship: 'Parent', phone: `${CITY[city].wa}${digits(5)}`, email: '' },
      createdAt: u.createdAt,
    });
    return u;
  });
  const emptyStudent = mkUser({ phone: '7777700000', role: 'student', name: 'Empty Student', city: 'Bengaluru', createdDaysAgo: 1 });
  studentProfiles.push({
    userId: emptyStudent._id,
    school: 'Demo International School',
    gradeYear: 'DP1',
    subjectIds: [],
    boardId: ibBoard._id,
    classLevelId: dp1._id,
    createdAt: emptyStudent.createdAt,
  });

  // Tutors
  const NEW_TUTORS = [
    { key: 'meera', name: 'Dr. Meera Raghavan', city: 'Bengaluru', v: 'approved', mode: 'both', premium: true, need: true, subj: [['Chemistry', 'HL'], ['Chemistry', 'SL'], ['Biology', 'HL']], usd: 48, exp: 14, langs: ['English', 'Hindi', 'Kannada', 'Tamil'], uni: 'Indian Institute of Science, Bengaluru', degree: 'PhD Organic Chemistry', qual: 'IB Chemistry examiner (Paper 2), 9 years', provider: 'zoom', longBio: true },
    { key: 'arjunk', name: 'Arjun Kapoor', city: 'Mumbai', v: 'approved', mode: 'offline', premium: false, need: false, subj: [['Mathematics AA HL', 'HL'], ['Mathematics AI SL', 'SL'], ['Physics', 'HL']], usd: 40, exp: 8, langs: ['English', 'Hindi', 'Marathi'], uni: 'IIT Bombay', degree: 'B.Tech Engineering Physics', qual: 'Former DP Maths HoD', provider: 'zoom' },
    { key: 'layla', name: 'Layla Hassan', city: 'Dubai', v: 'approved', mode: 'both', premium: true, need: true, subj: [['Economics', 'HL'], ['Business Management', 'HL'], ['Global Politics', 'SL']], usd: 60, exp: 11, langs: ['English', 'Arabic', 'French'], uni: 'London School of Economics', degree: 'MSc Economics', qual: 'IB Economics workshop leader', provider: 'meet' },
    { key: 'weijie', name: 'Wei Jie Ong', city: 'Singapore', v: 'approved', mode: 'online', premium: false, need: true, subj: [['Computer Science', 'HL'], ['Mathematics AA HL', 'HL'], ['Python', 'N/A']], usd: 55, exp: 6, langs: ['English', 'Mandarin'], uni: 'National University of Singapore', degree: 'BComp Computer Science', qual: 'IB CS IA moderator', provider: 'teams' },
    { key: 'charlotte', name: 'Charlotte Hughes', city: 'London', v: 'approved', mode: 'online', premium: false, need: true, subj: [['Language A Literature', 'HL'], ['Theory of Knowledge (TOK)', 'HL'], ['Extended Essay (EE)', 'HL']], usd: 65, exp: 12, langs: ['English', 'French'], uni: 'University of Oxford', degree: 'MA English Literature', qual: 'TOK coordinator, EE supervisor', provider: 'zoom', longBio: true },
    { key: 'matthieu', name: 'Matthieu Fontaine', city: 'Geneva', v: 'approved', mode: 'both', premium: false, need: true, subj: [['French', 'HL'], ['Physics', 'SL'], ['Theory of Knowledge (TOK)', 'SL']], usd: 70, exp: 9, langs: ['French', 'English', 'German'], uni: 'EPFL', degree: 'MSc Physics', qual: 'Bilingual DP teacher', provider: 'zoom' },
    { key: 'grace', name: 'Grace Lau', city: 'Hong Kong', v: 'approved', mode: 'online', premium: false, need: true, subj: [['Mandarin', 'HL'], ['Psychology', 'HL'], ['Biology', 'SL']], usd: 50, exp: 7, langs: ['Cantonese', 'Mandarin', 'English'], uni: 'University of Hong Kong', degree: 'BSocSc Psychology', qual: 'IB Psychology IA mentor', provider: 'zoom' },
    { key: 'pieter', name: 'Pieter van Dijk', city: 'Amsterdam', v: 'approved', mode: 'online', premium: false, need: true, subj: [['Environmental Systems', 'SL'], ['Geography', 'HL'], ['Chemistry', 'SL']], usd: 52, exp: 10, langs: ['Dutch', 'English', 'German'], uni: 'Utrecht University', degree: 'MSc Earth Sciences', qual: 'ESS examiner', provider: 'meet' },
    { key: 'nadia', name: 'Nadia Petrova', city: 'New York', v: 'pending', mode: 'online', premium: false, need: true, subj: [['Mathematics AI HL', 'HL'], ['Mathematics AI SL', 'SL']], usd: 75, exp: 5, langs: ['English', 'Russian'], uni: 'Columbia University', degree: 'MA Statistics', qual: 'AP/IB statistics teacher', provider: 'zoom' },
    { key: 'rahul', name: 'Rahul Banerjee', city: 'Mumbai', v: 'pending', mode: 'both', premium: false, need: true, subj: [['History', 'HL']], usd: 30, exp: 3, langs: ['English', 'Bengali', 'Hindi'], uni: 'Jadavpur University', degree: 'MA History', qual: 'B.Ed', provider: 'zoom' },
    { key: 'samuel', name: 'Samuel Adeyemi', city: 'London', v: 'rejected', mode: 'online', premium: false, need: true, subj: [['Business Management', 'SL']], usd: 45, exp: 2, langs: ['English', 'Yoruba'], uni: 'University of Manchester', degree: 'BA Business', qual: 'PGCE (in progress)', provider: 'zoom' },
    { key: 'hiroshi', name: 'Hiroshi Nakamura', city: 'Singapore', v: 'not_submitted', mode: 'online', premium: false, need: true, subj: [['Music', 'HL'], ['Keyboard', 'N/A']], usd: 58, exp: 15, langs: ['Japanese', 'English'], uni: 'Tokyo University of the Arts', degree: 'MMus Composition', qual: 'ABRSM examiner', provider: 'zoom' },
    { key: 'daniel', name: 'Daniel Foster', city: 'London', v: 'approved', mode: 'online', premium: false, need: true, status: 'blacklisted', blacklistReason: 'Solicited off-platform cash payments from two families (tickets #A-1042, #A-1077).', subj: [['Physics', 'HL']], usd: 62, exp: 6, langs: ['English'], uni: 'Imperial College London', degree: 'MSci Physics', qual: 'Former DP Physics teacher', provider: 'zoom' },
    { key: 'priyanka', name: 'Priyanka Sethi', city: 'Bengaluru', v: 'approved', mode: 'offline', premium: false, need: true, status: 'inactive', subj: [['Psychology', 'SL'], ['Biology', 'SL']], usd: 32, exp: 4, langs: ['English', 'Hindi'], uni: 'Christ University', degree: 'MSc Psychology', qual: 'Counselling psychologist', provider: 'zoom' },
    { key: 'kavita', name: 'Kavita Menon', city: 'Bengaluru', v: 'approved', mode: 'both', premium: false, need: true, phone: '8888800000', subj: [['Mathematics AA SL', 'SL'], ['Economics', 'SL']], usd: 35, exp: 5, langs: ['English', 'Malayalam'], uni: 'St. Joseph\'s College', degree: 'MSc Mathematics', qual: 'CBSE → IB transition specialist', provider: 'zoom', noSlots: true },
  ];
  const LONG_BIO =
    'I have spent more than a decade helping IB Diploma students move from "I sort of get it" to genuinely confident exam performance. ' +
    'My sessions follow a predictable rhythm: a five-minute retrieval warm-up, one core concept taught from first principles, two or three past-paper questions done together under light time pressure, and a short written reflection so you know exactly what to revise next. ' +
    'I mark against the current IB markschemes and share annotated scripts after every mock. For Internal Assessments I focus on research-question design, data quality and the evaluation criterion, which is where most students lose marks. ' +
    'Outside tutoring I moderate coursework, run teacher workshops on assessment for learning, and write question banks. Students describe my classes as calm, structured and surprisingly fun. ' +
    'If you are aiming for a 6 or 7 — or simply want to stop dreading Paper 2 — I would love to help.';
  const newTutors = {};
  NEW_TUTORS.forEach((t, i) => {
    const u = mkUser({
      phone: t.phone || `88888890${pad(i + 1)}`,
      role: 'tutor',
      name: t.name,
      city: t.city,
      status: t.status || (t.v === 'rejected' ? 'suspended' : 'active'),
      blacklistReason: t.blacklistReason || '',
      dob: new Date(Date.UTC(1978 + (i % 15), (i * 5) % 12, 10 + (i % 15))),
      sex: ['female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'male', 'male', 'male', 'female', 'female'][i],
      createdDaysAgo: int(60, 400),
    });
    const c = CITY[t.city];
    const cur = c.cur;
    const on = priceIn(cur, t.usd);
    const off = priceIn(cur, t.usd * 1.2);
    const area = pick(c.areas);
    tutorProfiles.push({
      userId: u._id,
      qualifications: t.qual,
      university: t.uni,
      degree: t.degree,
      experienceYears: t.exp,
      languages: t.langs,
      bio: t.longBio
        ? LONG_BIO
        : `${t.name.replace(/^Dr\. /, '')} teaches IB ${t.subj.map((s) => s[0]).join(', ')} with a focus on exam technique and clear, structured notes. ${t.exp} years of DP experience.`,
      hourlyRate: on,
      hourlyRateOnline: t.mode === 'offline' ? 0 : on,
      hourlyRateOffline: t.mode === 'online' ? 0 : off,
      teachingMode: t.mode,
      needBasedClasses: t.need,
      location: { city: t.city, state: c.state, area, address: `${int(1, 90)} ${pick(['Main Road', 'Park Street', 'High Street', 'Avenue'])}`, lat: c.lat, lng: c.lng },
      currentAddress: address(t.city, 'Current'),
      permanentAddress: address(t.city, 'Permanent'),
      currency: cur,
      dateOfBirth: u.dateOfBirth,
      sex: u.sex,
      introPageUrl: i % 3 === 0 ? `https://scholaris.example/tutors/${u.refCode}` : '',
      whatsappNumber: `${c.wa}${digits(5)}`,
      emergencyContact: { name: 'Family contact', relationship: 'Spouse', phone: `${c.wa}${digits(5)}`, email: '' },
      identity: { type: c.country === 'India' ? 'PAN' : 'Passport', number: c.country === 'India' ? `ABCPM${digits(4)}K` : `X${digits(8)}`, documentUrl: file('demo-id.pdf'), status: t.v === 'approved' ? 'verified' : 'unverified' },
      gst: c.country === 'India' && i % 2 === 0
        ? { hasGst: true, type: 'GSTIN', number: `29ABCPM${digits(4)}K1Z${int(1, 9)}`, legalName: t.name, registeredAddress: `${area}, ${t.city}`, status: 'verified', checkedAt: ago(40), portalNote: 'Active on GST portal' }
        : { hasGst: false },
      meetingProvider: t.provider,
      ratingAvg: 0,
      ratingCount: 0,
      isPremium: Boolean(t.premium),
      premiumUntil: t.premium ? fromNow(int(20, 160)) : undefined,
      premiumRank: t.premium ? int(12, 28) : 0,
      trialLessonAvailable: i % 2 === 0,
      verificationStatus: t.v,
      createdAt: u.createdAt,
    });
    newTutors[t.key] = { ...t, user: u, cur, on, off, tz: c.tz };
  });

  // Parents
  const NEW_PARENTS = [
    ['Sunita Malhotra', 'Mumbai', ['Ishaan Malhotra']],
    ['Lakshmi Krishnan', 'Bengaluru', ['Ananya Krishnan']],
    ['Khalid Al-Mansoori', 'Dubai', ['Yusuf Al-Mansoori']],
    ['David Tan', 'Singapore', ['Mei Ling Tan'], ['Hannah Lee', 'pending']],
    ['Sarah Bennett', 'London', ['Oliver Bennett']],
    ['Isabelle Dubois', 'Geneva', ['Camille Dubois']],
    ['Michael Wong', 'Hong Kong', ['Ethan Wong']],
    ['Rajiv Gupta', 'Bengaluru', ['Aarav Gupta'], ['Riya Deshpande', 'pending']],
    ['Fatima Haddad', 'Dubai', ['Noor Haddad'], null, 'inactive'],
    ['Anita Reddy', 'Bengaluru', ['Kavya Reddy'], ['Arjun Venkataraman', 'revoked']],
  ];
  const newParents = [];
  const linkRows = [];
  const stuByName = Object.fromEntries(newStudents.map((u) => [u.name, u]));
  NEW_PARENTS.forEach(([name, city, kids, extra, status], i) => {
    const u = mkUser({ phone: `66666670${pad(i + 1)}`, role: 'parent', name, city, status: status || 'active', sex: i % 2 ? 'male' : 'female' });
    parentProfiles.push({
      userId: u._id,
      whatsappNumber: `${CITY[city].wa}${digits(5)}`,
      emergencyContact: { name: 'Second guardian', relationship: 'Spouse', phone: `${CITY[city].wa}${digits(5)}`, email: '' },
      identity: { type: 'Passport', number: `P${digits(7)}`, status: i % 3 === 0 ? 'verified' : 'unverified' },
      createdAt: u.createdAt,
    });
    kids.forEach((k, j) =>
      linkRows.push({ parentUserId: u._id, studentUserId: stuByName[k]._id, relationship: j === 0 && i % 4 === 3 ? 'guardian' : 'parent', status: 'active', createdAt: u.createdAt })
    );
    if (extra) linkRows.push({ parentUserId: u._id, studentUserId: stuByName[extra[0]]._id, relationship: 'other', status: extra[1], createdAt: ago(5) });
    newParents.push(u);
  });
  const lonelyParent = mkUser({ phone: '6666600000', role: 'parent', name: 'Neha Kulkarni', city: 'Bengaluru', createdDaysAgo: 2 });
  parentProfiles.push({ userId: lonelyParent._id, createdAt: lonelyParent.createdAt });

  await put(User, userRows);
  await put(StudentProfile, studentProfiles);
  await put(TutorProfile, tutorProfiles);
  await put(ParentProfile, parentProfiles);
  await put(ParentStudentLink, linkRows);
  console.log(`Users: +${newStudents.length + 1} students, +${NEW_TUTORS.length} tutors, +${newParents.length + 1} parents, +${linkRows.length} parent links`);

  // Demo profile enrichment
  const sSubjects = [phys, mathAA, chem, econ, engB, tok];
  await StudentProfile.updateOne(
    { userId: S._id },
    {
      $set: {
        subjectIds: sSubjects.map((s) => s._id),
        studyStreak: 12,
        lastActivityDate: dayjs().format('YYYY-MM-DD'),
        dateOfBirth: new Date(Date.UTC(2008, 4, 14)),
        sex: 'female',
        preferredCurrency: 'USD',
        introPageUrl: '',
        whatsappNumber: '+91 98450 11223',
        addresses: [
          { label: 'Home', line1: '42, 12th Main Road', line2: 'HAL 2nd Stage', area: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'India', landmark: 'Near Indiranagar metro', lat: 12.9784, lng: 77.6408 },
          { label: 'Grandparents', line1: 'B-702, Sea Breeze Apartments', line2: 'Carter Road', area: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', postalCode: '400050', country: 'India', landmark: '', lat: 19.0662, lng: 72.8233 },
        ],
        emergencyContact: { name: 'Demo Parent', relationship: 'Mother', phone: '6666666666', email: 'parent@ibdp.demo' },
        identity: { type: 'Passport', number: 'Z1234567', documentUrl: file('demo-id.pdf'), status: 'verified' },
      },
    }
  );
  await User.updateOne({ _id: S._id }, { $set: { preferredCurrency: 'USD', sex: 'female', dateOfBirth: new Date(Date.UTC(2008, 4, 14)), countryId: countryByName.India._id } });
  await User.updateOne({ _id: P._id }, { $set: { country: 'India', countryId: countryByName.India._id, preferredCurrency: 'USD' } });
  await User.updateOne({ _id: T._id }, { $set: { countryId: countryByName.India._id, preferredCurrency: 'USD' } });
  await StudentProfile.updateOne({ userId: A._id }, { $set: { subjectIds: [bio._id, chem._id, SUBJ('Mathematics AA SL')._id, SUBJ('Psychology')._id, SUBJ('Language A Literature')._id, tok._id], studyStreak: 5 } });
  await StudentProfile.updateOne({ userId: R._id }, { $set: { subjectIds: [econ._id, SUBJ('Business Management')._id, SUBJ('Mathematics AI SL')._id, SUBJ('Geography')._id, engB._id, ee._id], studyStreak: 2 } });
  await ParentProfile.updateOne(
    { userId: P._id },
    { $set: { whatsappNumber: '+91 98450 66666', emergencyContact: { name: 'Vikram (spouse)', relationship: 'Spouse', phone: '+91 98450 77777', email: '' }, identity: { type: 'Aadhaar', number: 'XXXX-XXXX-4821', status: 'verified' } } }
  );
  await TutorProfile.updateOne(
    { userId: T._id },
    {
      $set: {
        bio: LONG_BIO,
        languages: ['English', 'Hindi', 'Kannada'],
        university: 'Indian Institute of Science, Bengaluru',
        degree: 'MSc Physics',
        qualifications: 'IB Physics examiner (Paper 2), Math AA HL teacher, EE supervisor',
        experienceYears: 9,
        location: { city: 'Bengaluru', state: 'Karnataka', area: 'Indiranagar', address: 'Demo Learning Studio, 12 7th Main', lat: 12.9719, lng: 77.6412 },
        currentAddress: { label: 'Studio', line1: '12, 7th Main', line2: 'HAL 2nd Stage', area: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'India', lat: 12.9719, lng: 77.6412 },
        whatsappNumber: '+91 98450 88888',
        identity: { type: 'PAN', number: 'ABCPD1234K', documentUrl: file('demo-id.pdf'), status: 'verified' },
        gst: { hasGst: true, type: 'GSTIN', number: '29ABCPD1234K1Z5', legalName: 'Demo Tutor Learning Studio', registeredAddress: 'Indiranagar, Bengaluru', status: 'verified', checkedAt: ago(30), portalNote: 'Active' },
        introPageUrl: 'https://scholaris.example/tutors/demo-tutor',
        needBasedClasses: true,
      },
    }
  );

  // ── Offerings ──────────────────────────────────────────────────────────────
  const existingOff = await TutorSubject.find({ tutorUserId: T._id }).lean();
  const offKey = (s, l) => `${sid(s)}|${l}`;
  const haveOff = new Set(existingOff.map((o) => offKey(o.subjectId, o.level)));
  const tOfferings = [];
  const addTOff = (name, level, online, offline, classLevel = dp2) => {
    const s = SUBJ(name);
    if (haveOff.has(offKey(s._id, level))) return;
    haveOff.add(offKey(s._id, level));
    tOfferings.push({ tutorUserId: T._id, subjectId: s._id, level, hourlyRate: online, onlineRate: online, offlineRate: offline, currency: 'USD', countryId: countryByName.India._id, boardId: ibBoard._id, classLevelId: classLevel._id, createdAt: ago(int(30, 120)) });
  };
  addTOff('Chemistry', 'HL', 52, 60);
  addTOff('Chemistry', 'SL', 45, 52, dp1);
  addTOff('Biology', 'HL', 48, 56);
  addTOff('Computer Science', 'HL', 50, 58);
  addTOff('Mathematics AA HL', 'HL', 58, 68);
  addTOff('Mathematics AA SL', 'SL', 46, 54, dp1);
  addTOff('Mathematics AI HL', 'HL', 50, 58);
  addTOff('Mathematics AI SL', 'SL', 42, 50, dp1);
  addTOff('Physics', 'SL', 44, 52, dp1);
  addTOff('Economics', 'SL', 40, 48, dp1);
  addTOff('Theory of Knowledge (TOK)', 'HL', 45, 50);
  addTOff('Extended Essay (EE)', 'HL', 60, 70);
  addTOff('Environmental Systems', 'SL', 38, 45, dp1);
  addTOff('Python', 'N/A', 30, 36);
  const otherOfferings = [];
  for (const t of Object.values(newTutors)) {
    for (const [name, level] of t.subj) {
      const s = SUBJ(name);
      const bump = level === 'SL' ? 0.85 : 1;
      otherOfferings.push({
        tutorUserId: t.user._id,
        subjectId: s._id,
        level,
        hourlyRate: Math.round(t.on * bump),
        onlineRate: t.mode === 'offline' ? 0 : Math.round(t.on * bump),
        offlineRate: t.mode === 'online' ? 0 : Math.round(t.off * bump),
        currency: t.cur,
        countryId: countryByName[CITY[t.city].country]._id,
        boardId: s.category === 'hobby' ? undefined : ibBoard._id,
        classLevelId: s.category === 'hobby' ? undefined : level === 'SL' ? dp1._id : dp2._id,
        createdAt: t.user.createdAt,
      });
    }
  }
  await put(TutorSubject, [...tOfferings, ...otherOfferings]);
  const allOfferings = await TutorSubject.find().lean();
  function rateFor(tutorId, subject, mode, level) {
    const list = allOfferings.filter((o) => sid(o.tutorUserId) === sid(tutorId) && sid(o.subjectId) === sid(subject));
    const o = list.find((x) => !level || x.level === level) || list[0];
    if (!o) return { rate: 40, currency: 'USD' };
    const rate = mode === 'offline' ? o.offlineRate || o.hourlyRate : o.onlineRate || o.hourlyRate;
    return { rate, currency: o.currency };
  }
  console.log(`Offerings: demo tutor now ${existingOff.length + tOfferings.length}; +${otherOfferings.length} for new tutors`);

  // ── Verifications ──────────────────────────────────────────────────────────
  const doc = (name, status = 'pending', extra = {}) => ({ url: file(name), name, mimeType: 'application/pdf', uploadedAt: ago(int(3, 40)), status, ...extra });
  const verRows = [];
  for (const t of Object.values(newTutors)) {
    const u = t.user;
    const slug = t.key;
    if (t.v === 'approved') {
      verRows.push({
        tutorUserId: u._id,
        documents: {
          identity: [doc(`${slug}-passport.pdf`, 'approved')],
          degree: [doc(`${slug}-degree.pdf`, 'approved')],
          certificate: [doc(`${slug}-ib-certificate.pdf`, 'approved')],
          resume: [doc(`${slug}-cv.pdf`, 'approved')],
        },
        references: [
          { name: 'Dr. Anjali Rao', relation: 'Former Head of Department', phone: `90000${digits(5)}`, email: 'anjali.rao@school.example', otpVerified: true, verifiedAt: ago(60) },
          { name: 'Mark Ellison', relation: 'DP Coordinator', phone: `90000${digits(5)}`, email: 'm.ellison@school.example', otpVerified: true, verifiedAt: ago(59) },
        ],
        notes: 'All documents verified against originals on video call.',
        status: 'approved',
        adminNote: 'Approved — degree verified with university registrar.',
        submittedAt: ago(70),
        reviewedAt: ago(66),
        createdAt: ago(75),
      });
    } else if (t.v === 'pending') {
      const full = slug === 'nadia';
      verRows.push({
        tutorUserId: u._id,
        documents: {
          identity: [doc(`${slug}-passport.pdf`)],
          degree: [doc(`${slug}-degree.pdf`), ...(full ? [doc(`${slug}-transcript.pdf`)] : [])],
          certificate: full ? [doc(`${slug}-teaching-licence.pdf`)] : [],
          resume: full ? [doc(`${slug}-cv.pdf`)] : [],
        },
        references: full
          ? [
              { name: 'Prof. Elena Morozova', relation: 'Thesis supervisor', phone: '9175550101', email: 'e.morozova@columbia.example', otpVerified: true, verifiedAt: ago(2) },
              { name: 'James O\'Connor', relation: 'Head of Maths, Dwight School', phone: '9175550102', email: 'joconnor@dwight.example', otpVerified: true, verifiedAt: ago(1) },
              { name: 'Lisa Park', relation: 'Colleague', phone: '9175550103', email: '', otpVerified: false },
            ]
          : [
              { name: 'Subhash Ghosh', relation: 'Principal', phone: '9830012345', otpVerified: false },
              { name: 'Rina Dutta', relation: 'Colleague', phone: '9830012346', otpVerified: true, verifiedAt: ago(1) },
            ],
        notes: full ? 'Uploaded everything requested. Happy to do a demo lesson.' : 'Resume to follow.',
        status: 'pending',
        submittedAt: ago(full ? 2 : 1, 4),
        createdAt: ago(6),
      });
    } else if (t.v === 'rejected') {
      verRows.push({
        tutorUserId: u._id,
        documents: {
          identity: [doc(`${slug}-passport.pdf`, 'approved')],
          degree: [doc(`${slug}-degree.pdf`, 'rejected', { rejectReason: 'Degree certificate is illegible — please upload a clear colour scan of both sides.' })],
          certificate: [],
          resume: [doc(`${slug}-cv.pdf`, 'approved')],
        },
        references: [
          { name: 'Tom Clarke', relation: 'Friend', phone: '7700900111', otpVerified: true, verifiedAt: ago(20) },
          { name: 'Ade Bello', relation: 'Relative', phone: '7700900112', otpVerified: false },
        ],
        notes: '',
        status: 'rejected',
        rejectReason: 'Degree document unreadable and references are personal rather than professional. Please resubmit.',
        adminNote: 'Asked for professional references (school or university).',
        submittedAt: ago(18),
        reviewedAt: ago(15),
        createdAt: ago(22),
      });
    } else {
      verRows.push({
        tutorUserId: u._id,
        documents: { identity: [doc(`${slug}-passport.pdf`)], degree: [], certificate: [], resume: [] },
        references: [],
        notes: '',
        status: 'not_submitted',
        createdAt: ago(9),
      });
    }
  }
  await put(TutorVerification, verRows);

  // ── Demo tutor availability grid (IST evenings, next 3 weeks) ──────────────
  // All demo-tutor future classes sit at 16:00–21:30 IST so the regression suite's
  // 08:30 IST bookings on days +9..+13 never collide.
  const STUDIO = { label: 'Demo Learning Studio', city: 'Bengaluru', state: 'Karnataka', area: 'Indiranagar', address: '12, 7th Main, HAL 2nd Stage', lat: 12.9719, lng: 77.6412 };
  const STUDIO2 = { label: 'Koramangala partner centre', city: 'Bengaluru', state: 'Karnataka', area: 'Koramangala', address: '80 Feet Road, 4th Block', lat: 12.9352, lng: 77.6245 };
  const SLOT_TIMES = [[16, 0], [17, 30], [19, 0], [20, 30]];
  const cells = new Map();
  const cellKey = (d, h, m) => `${d}|${h}|${m}`;
  for (let d = 1; d <= 21; d += 1) {
    SLOT_TIMES.forEach(([h, m], idx) => {
      const start = ist(d, h, m);
      if (dayjs(start).tz(IST).day() === 0 && idx % 2 === 1) return; // lighter Sundays
      const mode = (d + idx) % 3 === 0 ? 'offline' : 'online';
      cells.set(cellKey(d, h, m), { _id: oid(), start, mode, isBooked: false, loc: d % 4 === 0 ? STUDIO2 : STUDIO });
    });
  }
  // Later today (free) if still ahead.
  [[19, 0], [20, 30]].forEach(([h, m]) => {
    const start = ist(0, h, m);
    if (+start > NOW + 2 * 36e5) cells.set(cellKey(0, h, m), { _id: oid(), start, mode: 'online', isBooked: false, loc: STUDIO });
  });
  function claim(d, h, m, mode) {
    const k = cellKey(d, h, m);
    let c = cells.get(k);
    if (!c) {
      c = { _id: oid(), start: ist(d, h, m), mode, isBooked: false, loc: STUDIO };
      cells.set(k, c);
    }
    c.mode = mode;
    c.isBooked = true;
    return c;
  }

  // ── Bookings ───────────────────────────────────────────────────────────────
  const bookings = [];
  const payments = [];
  const reports = [];
  const changes = [];
  const subjName = (s) => s.name;
  const tutorInfo = new Map([[sid(T), { tz: IST, provider: 'zoom', name: T.name }]]);
  Object.values(newTutors).forEach((t) => tutorInfo.set(sid(t.user), { tz: t.tz, provider: t.provider, name: t.name }));
  const meetDigits = () => `8${digits(10)}`;

  function mkBooking(o) {
    const _id = oid();
    const mode = o.mode || 'online';
    const start = o.start;
    const end = o.end || new Date(+start + (o.mins || 60) * 6e4);
    const status = o.status || 'confirmed';
    const info = tutorInfo.get(sid(o.tutor)) || { provider: 'zoom' };
    const provider = o.provider || info.provider || 'zoom';
    const { rate, currency } = rateFor(o.tutor._id, o.subject._id, mode, o.level || levelOf(o.subject));
    const amount = o.amount ?? money((rate * (+end - +start)) / 36e5);
    const isPast = +end < NOW;
    let meetingStatus = o.meetingStatus;
    if (!meetingStatus) {
      if (status === 'cancelled') meetingStatus = 'cancelled';
      else if (status === 'completed') meetingStatus = o.attendance === 'absent' ? 'no_show' : 'ended';
      else meetingStatus = 'scheduled';
    }
    const createdAt = o.createdAt || minDate(new Date(+start - int(3, 12) * 864e5), ago(0, 2));
    const row = {
      _id,
      studentUserId: o.student._id,
      tutorUserId: o.tutor._id,
      subjectId: o.subject._id,
      level: o.level || levelOf(o.subject),
      slotId: o.slotId,
      startAt: start,
      endAt: end,
      timezone: o.tz || 'Asia/Kolkata',
      status,
      isRecurring: Boolean(o.seriesId),
      recurrenceRule: o.seriesId ? { frequency: 'weekly', count: o.seriesCount } : { frequency: 'none', count: 1 },
      parentBookingId: o.parentBookingId,
      seriesId: o.seriesId,
      bookedByUserId: (o.bookedBy || o.student)._id,
      deliveryMode: mode,
      planType: o.planType || (o.seriesId ? 'regular' : 'single'),
      refCode: `CLS-${String(_id).slice(-6).toUpperCase()}`,
      meetingProvider: provider,
      studentAddress: mode === 'offline' ? o.studentAddress || null : null,
      notes: o.notes || '',
      attendance: o.attendance || (status === 'completed' ? 'present' : 'pending'),
      amount,
      currency,
      meetingStatus,
      startedAt: o.startedAt || (['ended', 'live'].includes(meetingStatus) ? new Date(+start + int(0, 4) * 6e4) : undefined),
      completedAt: status === 'completed' ? o.completedAt || end : undefined,
      consumed: Boolean(o.consumed),
      consumedReason: o.consumedReason || '',
      classHistory: [],
      createdAt,
      updatedAt: isPast ? end : createdAt,
    };
    if (mode === 'online') {
      const mid = meetDigits();
      const tools = classToolsFor(_id, subjName(o.subject), provider);
      const join = `https://zoom.us/j/${mid}?pwd=${crypto.createHash('md5').update(mid).digest('hex').slice(0, 16)}`;
      row.zoom = { meetingId: mid, joinUrl: join, startUrl: `https://zoom.us/s/${mid}?zak=demo`, password: digits(6), provider };
      row.meetingUrl = tools.meetUrl || tools.teamsUrl || join;
      row.classTools = tools;
      row.classHistory.push(
        { kind: 'meeting', label: provider, url: row.meetingUrl, at: createdAt },
        { kind: 'whiteboard', label: 'Whiteboard', url: tools.whiteboardUrl, at: createdAt }
      );
    }
    if (status === 'completed' && !o.consumed && chance(0.5)) {
      const topicSlug = subjName(o.subject).toLowerCase().replace(/[^a-z]+/g, '-');
      row.classHistory.push({ kind: 'download', label: `${subjName(o.subject)} class notes.pdf`, url: file(`class-notes-${topicSlug}.pdf`), at: end });
    }
    if (mode === 'offline' && status === 'completed' && !o.consumed) {
      row.doorstep = { photoUrl: file('doorstep-checkin.png'), placePhotoUrl: file('doorstep-place.png'), checkedInAt: new Date(+start - 6e5), confirmedAt: new Date(+start - 3e5), lat: 12.97, lng: 77.64 };
    }
    bookings.push(row);
    return row;
  }

  function payFor(b, status, o = {}) {
    const info = tutorInfo.get(sid(b.tutorUserId));
    const subj = subjects.find((s) => sid(s) === sid(b.subjectId));
    const desc = `Class: ${subj?.name || 'Lesson'} · ${dayjs(b.startAt).tz(b.timezone || 'UTC').format('D MMM YYYY, HH:mm')} (${b.timezone || 'UTC'})`;
    const createdAt = o.createdAt || b.createdAt;
    const row = {
      _id: oid(),
      payerUserId: o.payer?._id || b.studentUserId,
      beneficiaryUserId: b.tutorUserId,
      bookingId: b._id,
      amount: b.amount,
      currency: b.currency,
      method: o.method || 'manual',
      status,
      description: desc,
      adminNote: o.adminNote || '',
      createdAt,
      updatedAt: createdAt,
    };
    if (status === 'paid' || status === 'refunded') {
      row.paidAt = o.paidAt || minDate(new Date(+createdAt + int(1, 30) * 36e5), ago(0, 1));
      row.updatedAt = row.paidAt;
      if (!row.adminNote && row.method === 'manual') row.adminNote = `Confirmed against UTR ${digits(12)}`;
    }
    if (status === 'refunded') {
      row.refundedAt = o.refundedAt || minDate(new Date(+row.paidAt + 2 * 864e5), ago(0, 2));
      row.updatedAt = row.refundedAt;
    }
    if (o.refundRequest) row.refundRequest = o.refundRequest;
    if (status === 'failed' && !row.adminNote) row.adminNote = pick(['Card declined by issuer (insufficient funds)', 'UPI collect request expired', '3-D Secure authentication failed']);
    void info;
    payments.push(row);
    return row;
  }

  const REPORT = {
    Physics: ['Kinematics: SUVAT equations', 'Projectile motion', 'Newton\'s laws & free-body diagrams', 'Momentum and impulse', 'Work, energy and power', 'Circular motion', 'Gravitational fields', 'Simple harmonic motion', 'Wave interference & diffraction', 'Electric fields', 'Electromagnetic induction', 'Thermal physics: latent heat', 'Nuclear binding energy', 'Photoelectric effect', 'Uncertainties & error bars'],
    Chemistry: ['Stoichiometry & limiting reagents', 'Electron configuration', 'VSEPR shapes', 'Energetics: Hess\'s law', 'Maxwell–Boltzmann & kinetics', 'Equilibrium: Kc & Le Chatelier', 'Buffers & pH', 'Redox & electrochemical cells', 'Organic chemistry: SN1/SN2', 'Electrophilic addition', 'Spectroscopy: IR, MS, ¹H NMR'],
    'Mathematics AA HL': ['Sequences & series', 'Proof by induction', 'Complex numbers: De Moivre', 'Function transformations', 'Trig identities', 'Vectors: lines & planes', 'Chain/product/quotient rules', 'Integration by parts', 'Differential equations', 'Maclaurin series', 'Bayes\' theorem', 'Normal distribution'],
    Biology: ['Cell structure', 'Membrane transport', 'Enzymes', 'Cell respiration', 'Photosynthesis', 'DNA replication', 'Protein synthesis', 'Mendelian genetics', 'Natural selection', 'Energy flow in ecosystems', 'Immunity'],
    Economics: ['Elasticities (PED/YED/PES)', 'Market failure & externalities', 'Government intervention', 'Market structures', 'Macro objectives', 'Fiscal & monetary policy', 'Exchange rates', 'Trade protection', 'Development economics'],
    'Theory of Knowledge (TOK)': ['Unpacking the essay prompt', 'Knowledge questions', 'AOK: natural sciences', 'Exhibition object selection', 'Perspectives & bias'],
    'Extended Essay (EE)': ['Narrowing the research question', 'Literature review', 'Methodology', 'Criterion C analysis', 'RPPF reflection'],
    'Computer Science': ['OOP: encapsulation & inheritance', 'UML class diagrams', 'Big-O complexity', 'Recursion', 'Networks', 'SQL basics'],
  };
  const topicsFor = (s) => REPORT[s.name] || ['Concept recap', 'Past-paper practice', 'Exam technique'];
  function addReport(b, o = {}) {
    const subj = subjects.find((s) => sid(s) === sid(b.subjectId));
    const tps = shuffle(topicsFor(subj)).slice(0, int(2, 3));
    const r = {
      _id: oid(),
      bookingId: b._id,
      tutorUserId: b.tutorUserId,
      studentUserId: b.studentUserId,
      subjectId: b.subjectId,
      summary: o.summary || `Worked through ${tps.join(' and ')} with two May-session past-paper questions. ${pick(['Good momentum today.', 'Needed a little more scaffolding on the second question.', 'Strong session — ready for timed practice.', 'Slower start, but the final question was fully correct.'])}`,
      topicsCovered: tps,
      strengths: pick(['Clear, well-labelled working.', 'Confident with algebraic manipulation.', 'Uses command terms correctly.', 'Good units and significant figures discipline.']),
      weaknesses: pick(['Rushes the final step — check units.', 'Needs more timed Paper 2 practice.', 'Mixes up similar definitions under pressure.', 'Diagram labelling is incomplete.']),
      studentMood: pick(['engaged', 'engaged', 'confident', 'neutral', 'anxious', 'distracted']),
      understandingRating: o.rating || int(2, 5),
      homeworkCompletion: pick(['done', 'done', 'partial', 'not_done', 'none_assigned']),
      nextSteps: pick(['Five warm-up questions before the next session.', 'Finish the markscheme self-check and flag doubts.', 'Redo Q3 without notes, then compare.', 'Read the IA exemplar and annotate criterion C.']),
      privateNotes: pick(['Parent asked for weekly updates.', 'Keep early questions untimed.', 'Consider moving to HL-level questions next month.', '']),
      sharedWithParent: o.shared ?? chance(0.8),
      createdAt: b.endAt,
      updatedAt: b.endAt,
    };
    reports.push(r);
    b.sessionReportId = r._id;
    return r;
  }

  // Past: demo student with demo tutor (8 weeks)
  const physPast = [-3, -10, -17, -24, -31, -38, -45, -52];
  physPast.forEach((d, i) => {
    const o = { student: S, tutor: T, subject: phys, start: ist(d, 17, 30), mode: 'online', status: 'completed', notes: 'Weekly Physics HL' };
    if (d === -24) Object.assign(o, { attendance: 'absent' });
    if (d === -38) Object.assign(o, { attendance: 'absent', consumed: true, consumedReason: 'late_cancel', meetingStatus: 'no_show' });
    const b = mkBooking(o);
    if (d === -38) {
      changes.push({ bookingId: b._id, studentUserId: S._id, tutorUserId: T._id, initiatedByUserId: S._id, initiatedByRole: 'student', kind: 'cancel', status: 'consumed', reason: 'School trip ran late — could not make it back in time.', noticeHours: 5.5, late: true, cycle: dayjs(b.startAt).format('YYYY-MM'), createdAt: new Date(+b.startAt - 5.5 * 36e5) });
      payFor(b, 'paid', { method: 'wallet' });
    } else if (d === -24) {
      payFor(b, 'paid');
    } else {
      addReport(b, { rating: 3 + (i % 3) });
      if (d === -3) payFor(b, 'pending', { createdAt: ago(5) });
      else if (d === -10) payFor(b, 'paid', { method: 'wallet', refundRequest: { status: 'requested', reason: 'class_not_held', note: 'Tutor joined 25 minutes late and the session was cut short to 35 minutes.', requestedBy: S._id, requestedAt: ago(2) } });
      else if (d === -17) payFor(b, 'paid', { refundRequest: { status: 'disputed', reason: 'quality', note: 'We spent most of the class on a topic I already knew.', requestedBy: S._id, requestedAt: ago(12), tutorNote: 'The full 60 minutes were delivered as planned; the lesson plan was agreed in chat on the day before.' } });
      else if (d === -31) payFor(b, 'refunded', { refundRequest: { status: 'refunded', reason: 'technical', note: 'Zoom kept dropping on the tutor side.', requestedBy: S._id, requestedAt: ago(29), tutorNote: 'Agreed — my connection failed. Refund approved.' } });
      else payFor(b, 'paid', { method: i % 2 ? 'wallet' : 'manual' });
    }
  });
  const mathPast = [-5, -12, -19, -26, -33, -40];
  mathPast.forEach((d, i) => {
    const o = { student: S, tutor: T, subject: mathAA, start: ist(d, 16, 0), mode: 'offline', status: 'completed', planType: 'subscription', notes: 'Saturday Math AA HL at the studio', studentAddress: null };
    if (d === -19) Object.assign(o, { status: 'cancelled', consumedReason: 'tutor_cancel' });
    const b = mkBooking(o);
    if (d === -19) {
      changes.push({ bookingId: b._id, studentUserId: S._id, tutorUserId: T._id, initiatedByUserId: T._id, initiatedByRole: 'tutor', kind: 'cancel', status: 'confirmed', reason: 'Invigilating the school mock exams that afternoon — apologies!', noticeHours: 52, late: false, cycle: dayjs(b.startAt).format('YYYY-MM'), createdAt: new Date(+b.startAt - 52 * 36e5) });
      payFor(b, 'cancelled');
    } else {
      addReport(b, { rating: 2 + (i % 4) });
      if (d === -5) payFor(b, 'awaiting_confirmation', { createdAt: ago(7), method: 'manual' });
      else if (d === -12) payFor(b, 'paid', { refundRequest: { status: 'accepted', reason: 'duplicate', note: 'I was charged twice for this class (see the other invoice).', requestedBy: P._id, requestedAt: ago(4), tutorNote: 'Confirmed duplicate charge — happy to refund.' } });
      else if (d === -26) payFor(b, 'paid', { refundRequest: { status: 'rejected', reason: 'changed_mind', note: 'Would like a refund as we are switching tutors.', requestedBy: P._id, requestedAt: ago(20), tutorNote: 'Class was delivered in full.' }, adminNote: 'Reviewed attendance and session report — refund declined per policy.' });
      else payFor(b, 'paid');
    }
  });
  [[-8, 'completed'], [-22, 'cancelled'], [-36, 'completed']].forEach(([d, status]) => {
    const b = mkBooking({ student: S, tutor: T, subject: chem, start: ist(d, 19, 0), mode: 'online', status, consumedReason: status === 'cancelled' ? 'on_time_cancel' : '', notes: 'Chemistry HL — organic & energetics' });
    if (status === 'cancelled') {
      changes.push({ bookingId: b._id, studentUserId: S._id, tutorUserId: T._id, initiatedByUserId: S._id, initiatedByRole: 'student', kind: 'cancel', status: 'confirmed', reason: 'Clashes with my CAS football tournament.', noticeHours: 70, late: false, cycle: dayjs(b.startAt).format('YYYY-MM'), createdAt: new Date(+b.startAt - 70 * 36e5) });
      payFor(b, 'cancelled');
    } else {
      addReport(b);
      payFor(b, d === -8 ? 'failed' : 'paid', d === -8 ? { createdAt: ago(9) } : {});
    }
  });
  // Declined reschedule on a past class (closed request).
  changes.push({ bookingId: bookings.find((b) => +b.startAt === +ist(-10, 17, 30))._id, studentUserId: S._id, tutorUserId: T._id, initiatedByUserId: S._id, initiatedByRole: 'student', kind: 'reschedule', status: 'declined', reason: 'Could we move this to Thursday?', noticeHours: 30, late: false, countsAgainstMonthly: true, cycle: dayjs(ago(12)).format('YYYY-MM'), createdAt: ago(12) });

  // Past: children with demo tutor
  [-2, -9, -16, -23].forEach((d) => {
    const o = { student: A, tutor: T, subject: bio, start: ist(d, 19, 0), mode: 'online', status: 'completed', bookedBy: P, notes: 'Biology HL weekly' };
    if (d === -9) Object.assign(o, { attendance: 'absent' });
    if (d === -16) Object.assign(o, { attendance: 'absent', consumed: true, consumedReason: 'no_show', meetingStatus: 'no_show' });
    const b = mkBooking(o);
    if (d === -16) {
      changes.push({ bookingId: b._id, studentUserId: A._id, tutorUserId: T._id, initiatedByUserId: T._id, initiatedByRole: 'tutor', kind: 'cancel', status: 'consumed', reason: 'Student did not join; waited 20 minutes.', noticeHours: -0.3, late: false, cycle: dayjs(b.startAt).format('YYYY-MM'), createdAt: new Date(+b.startAt + 20 * 6e4) });
    } else if (d !== -9) addReport(b, { shared: d !== -23 });
    payFor(b, d === -2 ? 'pending' : 'paid', { payer: P, method: d === -2 ? 'manual' : 'wallet', createdAt: d === -2 ? ago(4) : undefined });
  });
  [-4, -11, -18].forEach((d) => {
    const b = mkBooking({ student: R, tutor: T, subject: econ, start: ist(d, 20, 30), mode: 'offline', status: 'completed', bookedBy: P, studentAddress: { label: 'Home', line1: '17, Palm Grove', area: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', postalCode: '560034', country: 'India', lat: 12.935, lng: 77.62 }, notes: 'Economics HL at home' });
    addReport(b);
    payFor(b, d === -4 ? 'awaiting_confirmation' : 'paid', { payer: P, method: d === -18 ? 'wallet' : 'manual' });
  });

  // Older demo-tutor history with other students (fills earnings for 6 months).
  const historyStudents = [Sara, Liam, Priya, Omar, Maya, Noah, newStudents[0], newStudents[1], newStudents[8], newStudents[16]].filter(Boolean);
  for (let k = 0; k < 8; k += 1) {
    const d = -int(55, 185);
    const stu = historyStudents[k % historyStudents.length];
    const subj = [phys, mathAA, chem, SUBJ('Mathematics AA SL'), ee][k % 5];
    const mode = k % 4 === 0 ? 'offline' : 'online';
    const [h, m] = SLOT_TIMES[k % 4];
    const b = mkBooking({ student: stu, tutor: T, subject: subj, start: ist(d, h, m), mode, status: k % 9 === 4 ? 'cancelled' : 'completed', consumedReason: k % 9 === 4 ? 'on_time_cancel' : '' });
    if (b.status === 'completed') {
      if (k % 3 === 0) addReport(b);
      payFor(b, k === 7 ? 'refunded' : 'paid');
    } else payFor(b, 'cancelled');
  }
  // Recent past for other demo-tutor students (to-grade & reports lists)
  [[Sara, phys, -1, 17, 30], [Liam, chem, -6, 20, 30], [Omar, mathAA, -13, 19, 0], [Maya, phys, -20, 20, 30]].forEach(([stu, subj, d, h, m]) => {
    const b = mkBooking({ student: stu, tutor: T, subject: subj, start: ist(d, h, m), mode: 'online', status: 'completed' });
    addReport(b);
    payFor(b, 'paid');
  });

  // Today
  const liveA = mkBooking({ student: A, tutor: T, subject: bio, start: roundUp5(ago(0, 0, 58)), mins: 60, mode: 'online', status: 'confirmed', meetingStatus: 'live', bookedBy: P, notes: 'In progress now — Biology HL: cell respiration' });
  liveA.startedAt = new Date(+liveA.startAt + 2 * 6e4);
  payFor(liveA, 'paid', { payer: P, paidAt: ago(3) });
  const soonS = mkBooking({ student: S, tutor: T, subject: phys, start: roundUp5(fromNow(0, 0, 8)), mode: 'online', status: 'confirmed', notes: 'Starts within 15 minutes — Physics HL: electromagnetic induction' });
  payFor(soonS, 'paid', { method: 'wallet', paidAt: ago(2) });
  const ch = newTutors.charlotte;
  const liveS = mkBooking({ student: S, tutor: ch.user, subject: tok, start: new Date(+soonS.startAt - 60 * 6e4), mins: 60, mode: 'online', status: 'confirmed', meetingStatus: 'live', notes: 'In progress — TOK essay feedback' });
  liveS.startedAt = new Date(+liveS.startAt + 6e4);
  payFor(liveS, 'paid', { paidAt: ago(1) });
  const laterTodayS = mkBooking({ student: S, tutor: T, subject: mathAA, start: roundUp5(fromNow(0, 4)), mode: 'offline', status: 'confirmed', notes: 'Later today at the studio' });
  payFor(laterTodayS, 'pending', { createdAt: ago(1) });
  const todayR = mkBooking({ student: R, tutor: T, subject: econ, start: roundUp5(fromNow(0, 2, 15)), mode: 'offline', status: 'confirmed', bookedBy: P, studentAddress: { label: 'Home', line1: '17, Palm Grove', area: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', postalCode: '560034', country: 'India', lat: 12.935, lng: 77.62 } });
  payFor(todayR, 'awaiting_confirmation', { payer: P, createdAt: ago(2) });

  // Upcoming 3 weeks (demo tutor)
  function upcoming(stu, subj, d, h, m, mode, extra = {}) {
    const c = claim(d, h, m, mode);
    const b = mkBooking({ student: stu, tutor: T, subject: subj, start: c.start, mode, slotId: c._id, ...extra });
    return b;
  }
  const seriesPhys = oid();
  const sp1 = upcoming(S, phys, 1, 17, 30, 'online', { seriesId: seriesPhys, seriesCount: 3, notes: 'Weekly Physics HL (series)' });
  const sp2 = upcoming(S, phys, 8, 17, 30, 'online', { seriesId: seriesPhys, seriesCount: 3, parentBookingId: sp1._id });
  const sp3 = upcoming(S, phys, 15, 17, 30, 'online', { seriesId: seriesPhys, seriesCount: 3, parentBookingId: sp1._id });
  payFor(sp1, 'paid', { method: 'wallet', createdAt: ago(6) });
  payFor(sp2, 'pending', { createdAt: ago(6) });
  payFor(sp3, 'pending', { createdAt: ago(6) });
  const seriesBio = oid();
  const ab1 = upcoming(A, bio, 2, 19, 0, 'online', { seriesId: seriesBio, seriesCount: 3, bookedBy: P });
  const ab2 = upcoming(A, bio, 9, 19, 0, 'online', { seriesId: seriesBio, seriesCount: 3, parentBookingId: ab1._id, bookedBy: P });
  const ab3 = upcoming(A, bio, 16, 19, 0, 'online', { seriesId: seriesBio, seriesCount: 3, parentBookingId: ab1._id, bookedBy: P });
  payFor(ab1, 'paid', { payer: P, method: 'wallet', createdAt: ago(8) });
  payFor(ab2, 'awaiting_confirmation', { payer: P, createdAt: ago(8) });
  payFor(ab3, 'pending', { payer: P, createdAt: ago(8) });
  const sTokRes = upcoming(S, tok, 3, 20, 30, 'online', { status: 'rescheduled', notes: 'Moved from last Thursday at your request' });
  payFor(sTokRes, 'paid', { createdAt: ago(10) });
  const seriesMath = oid();
  const sm1 = upcoming(S, mathAA, 4, 16, 0, 'offline', { seriesId: seriesMath, seriesCount: 3, planType: 'subscription' });
  const sm2 = upcoming(S, mathAA, 11, 16, 0, 'offline', { seriesId: seriesMath, seriesCount: 3, planType: 'subscription', parentBookingId: sm1._id });
  const sm3 = upcoming(S, mathAA, 18, 16, 0, 'offline', { seriesId: seriesMath, seriesCount: 3, planType: 'subscription', parentBookingId: sm1._id });
  [sm1, sm2, sm3].forEach((b) => payFor(b, 'paid', { createdAt: ago(9) }));
  const homeR = { label: 'Home', line1: '17, Palm Grove', area: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', postalCode: '560034', country: 'India', lat: 12.935, lng: 77.62 };
  const re1 = upcoming(R, econ, 5, 20, 30, 'offline', { bookedBy: P, studentAddress: homeR });
  const re2 = upcoming(R, econ, 12, 20, 30, 'offline', { bookedBy: P, studentAddress: homeR });
  const re3 = upcoming(R, econ, 19, 20, 30, 'offline', { bookedBy: P, studentAddress: homeR });
  payFor(re1, 'failed', { payer: P, createdAt: ago(3) });
  payFor(re2, 'pending', { payer: P, createdAt: ago(3) });
  payFor(re3, 'pending', { payer: P, createdAt: ago(3) });
  const sChemPending = upcoming(S, chem, 6, 19, 0, 'online', { status: 'pending', notes: 'Requested — awaiting payment' });
  payFor(sChemPending, 'pending', { createdAt: ago(1) });
  const sPhysReq = upcoming(S, phys, 10, 20, 30, 'online', { notes: 'Extra Physics session before the mock' });
  payFor(sPhysReq, 'paid', { method: 'wallet', createdAt: ago(4) });
  const sMathOffer = upcoming(S, mathAA, 13, 17, 30, 'online');
  payFor(sMathOffer, 'pending', { createdAt: ago(5) });
  const sChemRepl = upcoming(S, chem, 17, 19, 0, 'online');
  payFor(sChemRepl, 'paid', { createdAt: ago(5) });
  [[Sara, phys, 7, 17, 30], [Liam, chem, 14, 19, 0], [Omar, mathAA, 20, 17, 30], [newStudents[1], phys, 6, 16, 0], [newStudents[8], mathAA, 9, 20, 30]].forEach(([stu, subj, d, h, m]) => {
    const b = upcoming(stu, subj, d, h, m, 'online');
    payFor(b, chance(0.5) ? 'paid' : 'pending');
  });

  // Open schedule changes
  const tBusyNow = bookings.filter((b) => sid(b.tutorUserId) === sid(T) && b.status !== 'cancelled');
  const freeOnline = [...cells.values()]
    .filter((c) => !c.isBooked && c.mode === 'online' && +c.start > NOW + 24 * 36e5)
    .filter((c) => !tBusyNow.some((b) => b.startAt < new Date(+c.start + 36e5) && b.endAt > c.start))
    .sort((a, b) => a.start - b.start);
  const cycleNow = dayjs().format('YYYY-MM');
  changes.push({ bookingId: sPhysReq._id, studentUserId: S._id, tutorUserId: T._id, initiatedByUserId: S._id, initiatedByRole: 'student', kind: 'reschedule', status: 'pending', reason: 'My Physics mock moved to that evening — could we shift this by a day?', noticeHours: money((+sPhysReq.startAt - NOW) / 36e5), late: false, countsAgainstMonthly: true, cycle: cycleNow, createdAt: ago(0, 5) });
  changes.push({ bookingId: sMathOffer._id, studentUserId: S._id, tutorUserId: T._id, initiatedByUserId: T._id, initiatedByRole: 'tutor', kind: 'reschedule', status: 'slots_offered', reason: 'I have an examiner meeting — here are three alternatives that week.', noticeHours: money((+sMathOffer.startAt - NOW) / 36e5), late: false, countsAgainstMonthly: false, cycle: cycleNow, offeredSlotIds: freeOnline.filter((c) => Math.abs(+c.start - +sMathOffer.startAt) < 5 * 864e5).slice(0, 3).map((c) => c._id), createdAt: ago(1, 3) });
  changes.push({ bookingId: sChemRepl._id, studentUserId: S._id, tutorUserId: T._id, initiatedByUserId: T._id, initiatedByRole: 'tutor', kind: 'reschedule', status: 'awaiting_replacement', reason: 'I am travelling for IB marking that week and have no free slot.', noticeHours: money((+sChemRepl.startAt - NOW) / 36e5), late: false, countsAgainstMonthly: false, cycle: cycleNow, createdAt: ago(0, 20) });
  changes.push({ bookingId: ab2._id, studentUserId: A._id, tutorUserId: T._id, initiatedByUserId: P._id, initiatedByRole: 'parent', kind: 'reschedule', status: 'awaiting_approval', reason: 'Requesting Dr. Meera for this week — same time works for Aanya.', noticeHours: money((+ab2.startAt - NOW) / 36e5), late: false, countsAgainstMonthly: true, cycle: cycleNow, replacementTutorUserId: newTutors.meera.user._id, createdAt: ago(0, 9) });
  changes.push({ bookingId: sTokRes._id, studentUserId: S._id, tutorUserId: T._id, initiatedByUserId: S._id, initiatedByRole: 'student', kind: 'reschedule', status: 'confirmed', reason: 'House-event clash — moving to the following week.', noticeHours: 60, late: false, countsAgainstMonthly: false, cycle: dayjs(ago(10)).format('YYYY-MM'), selectedSlotId: sTokRes.slotId, createdAt: ago(10) });

  // Demo student / children with other tutors — multi-currency
  const nt = newTutors;
  const otherForS = [
    [S, nt.layla, econ, -9, 14, 0, 'completed', 'paid'],
    [S, nt.layla, econ, 2, 14, 0, 'confirmed', 'pending'],
    [S, nt.weijie, cs, -15, 15, 0, 'completed', 'paid'],
    [S, nt.weijie, cs, 5, 15, 0, 'confirmed', 'paid'],
    [S, nt.charlotte, tok, -6, 21, 30, 'completed', 'paid'],
    [S, nt.charlotte, tok, -13, 21, 30, 'completed', 'paid-disputed'],
    [S, nt.charlotte, tok, -20, 21, 30, 'completed', 'paid'],
    [S, nt.charlotte, tok, 7, 21, 30, 'confirmed', 'awaiting_confirmation'],
    [S, nt.pieter, SUBJ('Environmental Systems'), 12, 14, 0, 'confirmed', 'failed'],
    [S, nt.matthieu, SUBJ('French'), -27, 21, 0, 'cancelled', 'cancelled'],
    [A, nt.meera, chem, 6, 18, 0, 'confirmed', 'pending'],
    [A, nt.meera, chem, -7, 18, 0, 'completed', 'paid'],
    [A, nt.grace, SUBJ('Psychology'), -14, 17, 0, 'completed', 'paid'],
    [R, nt.arjunk, SUBJ('Mathematics AI SL'), 3, 18, 0, 'confirmed', 'paid'],
    [R, nt.arjunk, SUBJ('Mathematics AI SL'), -11, 18, 0, 'completed', 'paid'],
  ];
  for (const [stu, t, subj, d, h, m, status, pst] of otherForS) {
    const mode = t.mode === 'offline' ? 'offline' : 'online';
    const b = mkBooking({ student: stu, tutor: t.user, subject: subj, level: t.subj.find((x) => x[0] === subj.name)?.[1], start: ist(d, h, m), mode, status, bookedBy: stu === S ? S : P, consumedReason: status === 'cancelled' ? 'tutor_cancel' : '', studentAddress: mode === 'offline' ? homeR : null });
    if (status === 'completed') addReport(b);
    if (pst === 'paid-disputed') {
      payFor(b, 'paid', { refundRequest: { status: 'disputed', reason: 'quality', note: 'Feedback on my essay was very brief.', requestedBy: S._id, requestedAt: ago(8), tutorNote: 'Detailed written feedback was emailed after class — attached in chat.' } });
    } else payFor(b, pst, { payer: stu === S ? S : P });
  }

  // Other tutors: their own students (admin/global volume)
  const poolStudents = [...newStudents.filter((u) => u.status === 'active'), ...baseExtraStudents.filter((u) => u.status === 'active')];
  const activeApproved = Object.values(newTutors).filter((t) => t.v === 'approved' && !t.noSlots && !t.status);
  for (const t of activeApproved) {
    for (let k = 0; k < 7; k += 1) {
      const stu = pick(poolStudents);
      const [name, level] = t.subj[k % t.subj.length];
      const subj = SUBJ(name);
      const past = k < 4;
      const d = past ? -int(2, 60) : int(2, 14);
      const status = k === 6 ? 'cancelled' : past ? 'completed' : k === 5 ? 'pending' : 'confirmed';
      const mode = t.mode === 'offline' ? 'offline' : t.mode === 'both' && k % 2 ? 'offline' : 'online';
      const b = mkBooking({ student: stu, tutor: t.user, subject: subj, level, start: atTz(t.tz, d, 16 + (k % 4), k % 2 ? 30 : 0), tz: stu.timezone || t.tz, mode, status, consumedReason: status === 'cancelled' ? 'on_time_cancel' : '', studentAddress: mode === 'offline' ? address(t.city) : null });
      if (status === 'completed') {
        if (k % 2 === 0) addReport(b);
        payFor(b, k === 1 ? 'pending' : 'paid', { method: k === 3 ? 'wallet' : 'manual' });
      } else if (status === 'cancelled') payFor(b, 'cancelled');
      else payFor(b, k === 4 ? 'awaiting_confirmation' : 'pending');
    }
  }

  // Availability for demo tutor: claimed cells + free cells; drop free cells overlapping any booking.
  const tutorBusy = bookings.filter((b) => sid(b.tutorUserId) === sid(T) && b.status !== 'cancelled');
  const slotRows = [];
  for (const c of cells.values()) {
    const end = new Date(+c.start + 36e5);
    if (!c.isBooked && tutorBusy.some((b) => b.startAt < end && b.endAt > c.start)) continue;
    slotRows.push({ _id: c._id, tutorUserId: T._id, startAt: c.start, endAt: end, timezone: IST, deliveryMode: c.mode, countryId: countryByName.India._id, location: c.mode === 'offline' ? c.loc : undefined, isBooked: c.isBooked, createdAt: ago(int(1, 14)) });
  }
  // Other approved tutors: free slots for 2 weeks (no slots for the "no availability" tutor).
  for (const t of activeApproved) {
    for (let d = 1; d <= 14; d += 1) {
      if (d % 3 === 0) continue;
      for (const [h, m] of [[17, 0], [18, 30]]) {
        const start = atTz(t.tz, d, h, m);
        const end = new Date(+start + 36e5);
        if (bookings.some((b) => sid(b.tutorUserId) === sid(t.user) && b.status !== 'cancelled' && b.startAt < end && b.endAt > start)) continue;
        const mode = t.mode === 'offline' ? 'offline' : t.mode === 'both' && (d + h) % 2 ? 'offline' : 'online';
        const c = CITY[t.city];
        slotRows.push({ tutorUserId: t.user._id, startAt: start, endAt: end, timezone: t.tz, deliveryMode: mode, countryId: countryByName[c.country]._id, location: mode === 'offline' ? { label: `${t.name.split(' ').slice(-1)[0]} studio`, city: t.city, state: c.state, area: c.areas[0], address: `${int(1, 90)} ${c.areas[0]} Road`, lat: c.lat, lng: c.lng } : undefined, isBooked: false, createdAt: ago(int(1, 10)) });
      }
    }
  }
  await put(AvailabilitySlot, slotRows);
  await put(Booking, bookings);
  await put(SessionReport, reports);
  await put(ScheduleChange, changes);
  console.log(`Bookings: +${bookings.length}  Slots: +${slotRows.length}  Reports: +${reports.length}  Schedule changes: +${changes.length}`);

  // ── Lesson plans, notes, videos, reviews ─────────────────────────────────
  const lessonRows = [];
  const sBookings = bookings.filter((b) => sid(b.tutorUserId) === sid(T) && [sid(S), sid(A), sid(R)].includes(sid(b.studentUserId)));
  sBookings.slice(0, 26).forEach((b, i) => {
    const subj = subjects.find((s) => sid(s) === sid(b.subjectId));
    const tps = topicsFor(subj);
    const t = tps[i % tps.length];
    const past = +b.endAt < NOW;
    lessonRows.push({
      tutorUserId: T._id,
      studentUserId: b.studentUserId,
      subjectId: b.subjectId,
      title: i === 3 ? `${subj.name}: ${t} — extended revision block covering definitions, derivations, three worked examples, two May-2024 Paper 2 questions and a timed mini-quiz with self-marking` : `${subj.name.replace(/ \(.*\)/, '')}: ${t}`,
      objectives: `By the end of the lesson the student can explain ${t.toLowerCase()} in their own words and answer a 6-mark Paper 2 question on it.`,
      content: `1. Retrieval warm-up (5 min)\n2. Concept: ${t} (15 min)\n3. Worked examples ×2 (15 min)\n4. Past-paper question under light timing (15 min)\n5. Reflection + homework set (10 min)`,
      resources: ['IB formula booklet', `${t} notes.pdf`, 'May 2024 TZ1 markscheme'],
      scheduledFor: b.startAt,
      bookingId: b._id,
      status: b.status === 'cancelled' ? 'draft' : past ? 'completed' : i % 3 === 0 ? 'draft' : 'ready',
      createdAt: new Date(+b.startAt - 3 * 864e5 < NOW ? +b.startAt - 3 * 864e5 : NOW - 36e5),
    });
  });
  ['Kinematics diagnostic for new DP1 students', 'Organic chemistry: SN1/SN2 — mechanism flashcard sprint', 'TOK essay prompts: brainstorming template', 'IA: uncertainty propagation workshop'].forEach((title, i) =>
    lessonRows.push({ tutorUserId: T._id, subjectId: [phys, chem, tok, phys][i]._id, title, objectives: 'Reusable template', content: 'Template — duplicate per student.', resources: ['Template'], status: i % 2 ? 'ready' : 'draft', createdAt: ago(20 + i) })
  );
  await put(LessonPlan, lessonRows);

  const noteRows = [
    [S, 'Strong intuition for mechanics; electricity & magnetism still shaky — especially flux linkage sign conventions.', ['physics', 'em-induction']],
    [S, 'Mock target: 6 in Physics HL. Needs 2 timed Paper 2s per week until December.', ['target', 'mocks']],
    [S, 'Parent prefers WhatsApp updates on Sundays. Student is anxious before mocks — start every session with an easy win.', ['parent', 'wellbeing']],
    [S, 'IA idea: pendulum large-angle correction. Check the data range covers at least 5 angles above 20°. ' + 'Remind about the uncertainty treatment for the timing gate — the previous draft averaged without propagating. '.repeat(3), ['ia', 'long-note']],
    [A, 'Very organised; Biology diagrams excellent. Missed two classes this month — check in with parent.', ['attendance', 'biology']],
    [A, 'Struggles with respiration stages under time pressure.', ['biology', 'timing']],
    [R, 'Good real-world examples in Economics; evaluation paragraphs need structure (PEEL).', ['economics', 'writing']],
    [R, 'Offline at home — parking is tricky, arrive 10 min early.', ['logistics']],
    [Sara, 'Ready to move from SL to HL problems.', ['progress']],
    [Liam, 'Prefers visual explanations; send diagrams beforehand.', ['learning-style']],
  ].map(([stu, note, tags], i) => ({ tutorUserId: T._id, studentUserId: stu._id, note, tags, createdAt: ago(i * 3 + 1) }));
  await put(StudentNote, noteRows);

  const SAMPLE_MP4 = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
  await put(TutorVideo, [
    { tutorUserId: T._id, title: 'How I structure a Physics HL lesson', kind: 'intro', fileUrl: SAMPLE_MP4, isActive: true, createdAt: ago(50) },
    { tutorUserId: T._id, title: 'Sample: Electromagnetic induction in 8 minutes', kind: 'sample', fileUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', isActive: true, createdAt: ago(40) },
    { tutorUserId: T._id, title: 'Sample: Integration by parts — the LIATE trick and when it fails', kind: 'sample', fileUrl: SAMPLE_MP4, isActive: true, createdAt: ago(30) },
    { tutorUserId: T._id, title: 'Old intro (2024) — hidden', kind: 'intro', fileUrl: SAMPLE_MP4, isActive: false, createdAt: ago(300) },
    ...activeApproved.slice(0, 5).map((t, i) => ({ tutorUserId: t.user._id, title: `Meet ${t.name.split(' ')[0]} — ${t.subj[0][0]}`, kind: 'intro', fileUrl: SAMPLE_MP4, isActive: true, createdAt: ago(60 + i) })),
  ]);

  const REVIEW_TEXT = [
    [5, 'Explains even the scariest Paper 2 questions calmly. My predicted grade went from 5 to 7.'],
    [5, 'Super organised — every class has a plan, notes afterwards and homework that actually helps.'],
    [4, 'Really good at mechanics. Electricity topics felt a bit rushed but overall excellent.'],
    [5, 'The IA feedback was detailed and honest. Highly recommend for anyone stuck on criterion C.'],
    [3, 'Knowledgeable, but sessions sometimes ran over and I had to leave for school.'],
    [4, 'Patient and clear. Would love more past papers between classes.'],
    [5, 'Best tutor I have had. The SN1/SN2 explanation finally made organic click for me.'],
    [4, 'Good structure, very responsive on chat.'],
    [5, 'My daughter looks forward to these sessions — that says everything. ' + 'Consistent, kind and very well prepared for every single class, including the weeks when she was unwell and needed to catch up. '.repeat(2)],
    [2, 'Had to reschedule twice due to tutor travel; the lessons themselves were fine.'],
  ];
  const existingRevStudents = new Set((await TutorReview.find({ tutorUserId: T._id }).lean()).map((r) => sid(r.studentUserId)));
  const reviewRows = [];
  newStudents.filter((u) => u.status === 'active').slice(0, 10).forEach((u, i) => {
    if (existingRevStudents.has(sid(u))) return;
    const [rating, comment] = REVIEW_TEXT[i % REVIEW_TEXT.length];
    reviewRows.push({ tutorUserId: T._id, studentUserId: u._id, rating, comment, createdAt: ago(int(2, 120)) });
  });
  for (const t of activeApproved) {
    const n = int(3, 9);
    shuffle(poolStudents).slice(0, n).forEach((u) => {
      const [rating, comment] = REVIEW_TEXT[int(0, REVIEW_TEXT.length - 1)];
      reviewRows.push({ tutorUserId: t.user._id, studentUserId: u._id, rating: Math.max(3, rating), comment, createdAt: ago(int(2, 200)) });
    });
  }
  await put(TutorReview, reviewRows);
  // Recalculate ratings from actual reviews (mirrors tutor.repo.recalculateRating).
  const agg = await TutorReview.aggregate([{ $group: { _id: '$tutorUserId', avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  for (const row of agg) {
    await TutorProfile.updateOne({ userId: row._id }, { $set: { ratingAvg: Math.round(row.avg * 10) / 10, ratingCount: row.n } });
  }
  console.log(`Lesson plans: +${lessonRows.length}  Notes: +${noteRows.length}  Reviews: +${reviewRows.length}`);

  // ── Plans ──────────────────────────────────────────────────────────────────
  await put(SubscriptionPlan, [
    { name: 'Starter Pack (India)', description: '4 lesson credits, billed in INR', price: 7999, currency: 'INR', billingCycle: 'one_time', features: ['4 lessons', 'Homework support', 'Parent summary'], audience: 'student', planKind: 'regular', classCount: 4, createdAt: ago(90) },
    { name: 'Gulf Exam Sprint', description: '8 exam-focused sessions for UAE students', price: 649, currency: 'AED', billingCycle: 'one_time', features: ['8 lessons', 'Mock marking'], audience: 'student', planKind: 'subscription', classCount: 8, createdAt: ago(80) },
    { name: 'London IA Support Bundle', description: 'Three IA checkpoints with written feedback', price: 189, currency: 'GBP', billingCycle: 'one_time', features: ['3 checkpoints', 'Annotated drafts'], audience: 'student', planKind: 'regular', classCount: 3, createdAt: ago(70) },
    { name: 'Tutor Spotlight Quarterly', description: 'Featured placement for 3 months', price: 129, currency: 'USD', billingCycle: 'quarterly', features: ['Top of search', 'Premium badge', 'Profile review'], audience: 'tutor', planKind: 'premium', rankBoost: 25, createdAt: ago(60) },
    { name: 'Legacy Annual (retired)', description: 'No longer sold — kept for old invoices', price: 999, currency: 'USD', billingCycle: 'yearly', features: ['Unlimited sessions'], audience: 'student', isActive: false, createdAt: ago(400) },
  ]);
  const plans = await SubscriptionPlan.find().lean();
  const planBy = (n) => plans.find((p) => p.name === n);
  const planPay = (payer, plan, status, daysAgo, o = {}) => {
    const createdAt = ago(daysAgo);
    const row = { _id: oid(), payerUserId: payer._id, planId: plan._id, amount: plan.price, currency: plan.currency, method: o.method || 'manual', status, description: `Subscription: ${plan.name}`, adminNote: o.adminNote || '', createdAt, updatedAt: createdAt };
    if (status === 'paid') row.paidAt = new Date(+createdAt + 36e5);
    if (status === 'failed' && !row.adminNote) row.adminNote = 'Card declined by issuer';
    payments.push(row);
    return row;
  };
  planPay(S, planBy('Exam Sprint'), 'paid', 20, { method: 'wallet' });
  planPay(S, planBy('IA Mentoring'), 'pending', 1);
  planPay(P, planBy('Family Plan'), 'paid', 15, { method: 'wallet' });
  planPay(P, planBy('Parent Plus'), 'failed', 3);
  planPay(T, planBy('Tutor Premium Year'), 'paid', 75);
  planPay(T, planBy('Tutor Spotlight Quarterly'), 'awaiting_confirmation', 2);
  planPay(nt.meera.user, planBy('Tutor Premium'), 'paid', 25);
  planPay(nt.layla.user, planBy('Tutor Premium Year'), 'paid', 40);
  planPay(newStudents[0], planBy('Starter Pack (India)'), 'paid', 33);
  planPay(newStudents[2], planBy('Gulf Exam Sprint'), 'pending', 4);
  planPay(newStudents[4], planBy('London IA Support Bundle'), 'paid', 18);

  // ── Courses + enrollments ────────────────────────────────────────────────
  const tLessons = await LessonPlan.find({ tutorUserId: T._id }).select('_id').lean();
  const courseRows = [
    { title: 'IB Physics HL: Complete Paper 2 Mastery — Mechanics, Fields, Waves and Nuclear Physics with 120 Worked Past-Paper Questions (May 2027 cohort)', subject: phys, level: 'HL', price: 349, status: 'published', long: true },
    { title: 'Organic chemistry: SN1/SN2 in six sessions', subject: chem, level: 'HL', price: 149, status: 'published' },
    { title: 'TOK essay clinic: May 2027 prompts', subject: tok, level: 'HL', price: 129, status: 'published' },
    { title: 'Math AA HL: Proof & induction intensive', subject: mathAA, level: 'HL', price: 119, status: 'draft' },
    { title: 'IA sprint: from research question to final draft', subject: phys, level: 'HL', price: 199, status: 'published' },
    { title: 'Kinematics foundations for new DP1 students', subject: SUBJ('Physics'), level: 'SL', price: 59, status: 'published' },
    { title: 'Legacy: Physics SL (2016 syllabus)', subject: phys, level: 'SL', price: 49, status: 'archived' },
  ].map((c, i) => ({
    _id: oid(),
    tutorUserId: T._id,
    title: c.title,
    description: c.long
      ? `${c.title}. ` + 'Twelve structured modules, each with a concept video, a worked-example walkthrough, a timed past-paper set and a markscheme debrief. Includes weekly live Q&A, printable formula summaries and a final full mock marked against the 2025 markscheme. '.repeat(3)
      : `${c.title} — structured IB lessons with homework, past papers and markscheme debriefs.`,
    subjectId: c.subject._id,
    level: c.level,
    countryId: countryByName.India._id,
    price: c.price,
    currency: 'USD',
    thumbnail: '',
    lessonPlanIds: tLessons.slice(i, i + 4).map((l) => l._id),
    status: c.status,
    createdAt: ago(30 + i * 9),
  }));
  for (const t of activeApproved) {
    const [name, level] = t.subj[0];
    courseRows.push({ _id: oid(), tutorUserId: t.user._id, title: `${name.replace(/ \(.*\)/, '')} ${level} — exam bootcamp with ${t.name.split(' ')[0]}`, description: `Eight sessions of focused ${name} revision, past papers and feedback.`, subjectId: SUBJ(name)._id, level, countryId: countryByName[CITY[t.city].country]._id, price: priceIn(t.cur, 140), currency: t.cur, lessonPlanIds: [], status: 'published', createdAt: ago(int(20, 90)) });
  }
  await put(Course, courseRows);
  const existingEnroll = new Set((await CourseEnrollment.find().lean()).map((e) => `${e.courseId}|${e.studentUserId}`));
  const enrollRows = [];
  const enroll = (course, stu, status, payStatus, payer = stu, daysAgo = 10) => {
    const key = `${course._id}|${stu._id}`;
    if (existingEnroll.has(key)) return;
    existingEnroll.add(key);
    let paymentId;
    if (payStatus) {
      const createdAt = ago(daysAgo);
      const p = { _id: oid(), payerUserId: payer._id, beneficiaryUserId: course.tutorUserId, courseId: course._id, amount: course.price, currency: course.currency, method: 'manual', status: payStatus, description: `Course: ${course.title}`, createdAt, updatedAt: createdAt };
      if (payStatus === 'paid' || payStatus === 'refunded') p.paidAt = new Date(+createdAt + 2 * 36e5);
      if (payStatus === 'refunded') p.refundedAt = new Date(+createdAt + 3 * 864e5);
      payments.push(p);
      paymentId = p._id;
    }
    enrollRows.push({ courseId: course._id, studentUserId: stu._id, paymentId, status, createdAt: ago(daysAgo) });
  };
  const tCourses = courseRows.filter((c) => sid(c.tutorUserId) === sid(T));
  enroll(tCourses[0], S, 'active', 'paid', S, 40);
  enroll(tCourses[1], S, 'active', 'paid', P, 25);
  enroll(tCourses[2], S, 'pending', 'pending', S, 2);
  enroll(tCourses[4], S, 'cancelled', 'refunded', S, 35);
  enroll(tCourses[5], A, 'active', 'paid', P, 18);
  enroll(tCourses[0], R, 'pending', 'awaiting_confirmation', P, 1);
  const pubCourses = courseRows.filter((c) => c.status === 'published');
  poolStudents.slice(0, 18).forEach((u, i) => enroll(pubCourses[(i * 3) % pubCourses.length], u, i % 6 === 0 ? 'pending' : i % 7 === 0 ? 'cancelled' : 'active', i % 6 === 0 ? 'pending' : i % 7 === 0 ? 'cancelled' : 'paid', u, int(3, 80)));
  await put(CourseEnrollment, enrollRows);
  console.log(`Courses: +${courseRows.length}  Enrollments: +${enrollRows.length}`);

  // ── Projects ───────────────────────────────────────────────────────────────
  const projectRows = [];
  const mkProject = (o) => {
    const _id = oid();
    const createdAt = o.createdAt || ago(int(5, 40));
    let paymentId;
    if (o.pay) {
      const p = { _id: oid(), payerUserId: (o.payer || o.student)._id, beneficiaryUserId: o.tutor._id, projectId: _id, amount: o.price, currency: o.currency || 'USD', method: 'manual', status: o.pay, description: `Project: ${o.name}`, createdAt, updatedAt: createdAt };
      if (o.pay === 'paid') p.paidAt = new Date(+createdAt + 864e5);
      payments.push(p);
      paymentId = p._id;
    }
    projectRows.push({
      _id,
      tutorUserId: o.tutor._id,
      studentUserId: o.student?._id,
      subjectId: o.subject?._id,
      openToJoin: Boolean(o.open),
      kind: o.kind || 'project',
      name: o.name,
      description: o.description || `${o.name}. Scope agreed in chat; includes one round of revisions and a short call to walk through the feedback.`,
      status: o.status,
      price: o.price,
      currency: o.currency || 'USD',
      deliveryDate: o.delivery,
      attachments: o.attachments || [pdfAtt('project-brief.pdf')],
      deliverables: o.deliverables || [],
      paymentId,
      createdAt,
      updatedAt: createdAt,
    });
  };
  mkProject({ tutor: T, student: S, subject: phys, name: 'Physics IA: pendulum large-angle investigation — data review', status: 'proposed', price: 120, delivery: fromNow(12) });
  mkProject({ tutor: T, student: S, subject: ee, name: 'Extended Essay: annotated bibliography check (15 sources)', status: 'accepted', price: 90, pay: 'paid', delivery: fromNow(6) });
  mkProject({ tutor: T, student: S, subject: mathAA, name: 'Math AA HL exploration polish — modelling epidemic curves', status: 'in_progress', price: 150, pay: 'paid', delivery: fromNow(3), deliverables: [pdfAtt('exploration-draft-v2.pdf')] });
  mkProject({ tutor: T, student: S, subject: chem, kind: 'assignment', name: 'Chemistry IA: kinetics data processing & uncertainties', status: 'delivered', price: 110, pay: 'paid', delivery: ago(1), deliverables: [pdfAtt('chem-ia-feedback.pdf'), pdfAtt('chem-ia-processed-data.pdf')] });
  mkProject({ tutor: T, student: S, subject: tok, name: 'TOK exhibition: three objects & commentary review', status: 'completed', price: 80, pay: 'paid', delivery: ago(14), deliverables: [pdfAtt('tok-exhibition-marked.pdf')], createdAt: ago(30) });
  mkProject({ tutor: T, student: S, subject: econ, name: 'Economics IA commentary #2 — rewrite', status: 'cancelled', price: 70, pay: 'cancelled', delivery: ago(5) });
  mkProject({ tutor: T, student: A, subject: bio, payer: P, name: 'Biology IA: enzyme activity vs temperature — method check', status: 'in_progress', price: 100, pay: 'paid', delivery: fromNow(8) });
  mkProject({ tutor: T, student: R, subject: econ, payer: P, name: 'Economics IA: microeconomics commentary on Bengaluru metro fares', status: 'proposed', price: 95, pay: 'pending', delivery: fromNow(15) });
  mkProject({ tutor: T, open: true, subject: phys, name: 'Open group: Physics HL Paper 2 marathon (Saturday)', status: 'proposed', price: 35, delivery: fromNow(10), description: 'Small-group (max 6) four-hour marathon through two full Paper 2s with live marking. Join to reserve a seat.' });
  mkProject({ tutor: T, open: true, subject: ee, name: 'Open group: EE research-question workshop — turning a broad interest into a focused, answerable question in under two hours', status: 'proposed', price: 25, delivery: fromNow(18) });
  mkProject({ tutor: nt.charlotte.user, open: true, subject: tok, name: 'TOK essay feedback circle', status: 'proposed', price: 30, currency: 'GBP', delivery: fromNow(9) });
  mkProject({ tutor: nt.meera.user, student: A, subject: chem, payer: P, name: 'Chemistry IA titration data review', status: 'delivered', price: 6500, currency: 'INR', pay: 'paid', delivery: ago(2), deliverables: [pdfAtt('meera-ia-review.pdf')] });
  mkProject({ tutor: nt.layla.user, student: S, subject: econ, name: 'Economics IA portfolio check', status: 'accepted', price: 450, currency: 'AED', pay: 'awaiting_confirmation', delivery: fromNow(11) });
  await put(Project, projectRows);
  console.log(`Projects: +${projectRows.length}`);

  // ── Resources ──────────────────────────────────────────────────────────────
  const RES = [
    [phys, [['Kinematics', 'A.1 Kinematics'], ['Forces and momentum', 'A.2 Forces & momentum'], ['Work, energy and power', 'A.3 Work, energy & power'], ['Thermal energy transfers', 'B.1 Thermal energy'], ['Simple harmonic motion', 'C.1 SHM'], ['Electromagnetic induction', 'D.4 Induction'], ['Nuclear physics', 'E.3 Radioactive decay']]],
    [chem, [['Organic chemistry: SN1/SN2', 'R3.4 Electron-pair sharing'], ['Energetics & Hess\'s law', 'R1.1 Measuring enthalpy'], ['Equilibrium', 'R2.3 Equilibrium'], ['Acids and bases', 'R3.1 Proton transfer'], ['Redox', 'R3.2 Electron transfer'], ['Atomic structure', 'S1.2 Nuclear atom']]],
    [mathAA, [['Sequences & series', 'Topic 1 Number & algebra'], ['Proof by induction', 'Topic 1 Number & algebra'], ['Complex numbers', 'Topic 1 Number & algebra'], ['Differential equations', 'Topic 5 Calculus'], ['Integration techniques', 'Topic 5 Calculus'], ['Probability distributions', 'Topic 4 Statistics'], ['Vectors, lines & planes', 'Topic 3 Geometry']]],
    [bio, [['Cell structure', 'A2.2 Cell structure'], ['Genetics & inheritance', 'D3.2 Inheritance'], ['Ecology', 'C4.1 Populations'], ['Enzymes & metabolism', 'C1.1 Enzymes']]],
    [econ, [['Elasticities', 'Unit 2.3 Elasticity'], ['Market failure', 'Unit 2.8 Market failure'], ['Macroeconomic objectives', 'Unit 3.3'], ['International trade', 'Unit 4.2']]],
    [tok, [['TOK essay prompts (May 2027)', 'Essay'], ['TOK exhibition: 35 IA prompts', 'Exhibition'], ['Knowledge & the knower', 'Core theme']]],
    [ee, [['Research question design', 'Planning'], ['Reflection (RPPF)', 'Reflection'], ['Criterion C: critical thinking', 'Assessment']]],
    [cs, [['OOP & UML', 'Option D'], ['Algorithms & complexity', 'Topic 4'], ['Networks', 'Topic 3']]],
    [SUBJ('Language A Literature'), [['Paper 1 guided analysis', 'Paper 1'], ['Global issue for the IO', 'Individual oral']]],
  ];
  const YEARS = ['2023-24', '2024-25', '2025-26', '2026-27'];
  const TYPE_LABEL = { notes: 'Revision notes', question_bank: 'Question bank', past_paper: 'Past paper', markscheme: 'Markscheme', formula_sheet: 'Formula sheet', flashcards: 'Flashcards', mind_map: 'Mind map', practice_test: 'Practice test' };
  const creators = [admin, T, T, nt.meera.user, nt.charlotte.user, nt.weijie.user];
  const resourceRows = [];
  let ri = 0;
  for (const [subj, topicList] of RES) {
    for (const [topic, chapter] of topicList) {
      const type = RESOURCE_TYPES[ri % RESOURCE_TYPES.length];
      const paid = ri % 3 === 1;
      const creator = creators[ri % creators.length];
      const year = YEARS[ri % YEARS.length];
      const fname = `res-${subj.name.toLowerCase().replace(/[^a-z]+/g, '-')}-${type}-${ri}.pdf`;
      const title =
        type === 'past_paper'
          ? `${subj.name.replace(/ \(.*\)/, '')} — May ${2020 + (ri % 5)} TZ${1 + (ri % 2)} Paper ${1 + (ri % 3)} (${topic})`
          : type === 'markscheme'
            ? `${topic} — markscheme with examiner comments (${year})`
            : ri === 7
              ? `${topic}: the complete ${TYPE_LABEL[type].toLowerCase()} — every definition, derivation, common misconception, command term and examiner report insight from the last six sessions, organised by syllabus statement`
              : `${topic} — ${TYPE_LABEL[type]}`;
      resourceRows.push({
        _id: oid(),
        title,
        description: ri % 11 === 0 ? `${title}. ` + 'Includes worked solutions, colour-coded markscheme points and a short self-check quiz at the end of each section. '.repeat(3) : `${TYPE_LABEL[type]} for ${topic} (${chapter}).`,
        subjectId: subj._id,
        level: ri % 4 === 0 ? 'SL' : 'HL',
        topic,
        chapter,
        academicYear: year,
        type,
        fileUrl: file(fname),
        createdBy: creator._id,
        isActive: ri % 17 !== 5,
        accessType: paid ? 'paid' : 'free',
        price: paid ? [4.99, 7.5, 9.99, 12, 15][ri % 5] : 0,
        currency: 'USD',
        isDownloadable: ri % 9 !== 2,
        downloadableUntil: ri % 10 === 3 ? fromNow(30) : undefined,
        createdAt: ago(int(3, 220)),
      });
      ri += 1;
    }
  }
  // Pad to 50+ new rows with extra past papers / formula sheets.
  while (resourceRows.length < 52) {
    const [subj, list] = RES[resourceRows.length % RES.length];
    const [topic, chapter] = list[resourceRows.length % list.length];
    const type = ['past_paper', 'formula_sheet', 'flashcards', 'practice_test'][resourceRows.length % 4];
    resourceRows.push({ _id: oid(), title: `${subj.name.replace(/ \(.*\)/, '')} ${TYPE_LABEL[type]} — ${topic} (set ${resourceRows.length})`, description: `Extra ${TYPE_LABEL[type].toLowerCase()} for ${topic}.`, subjectId: subj._id, level: 'HL', topic, chapter, academicYear: pick(YEARS), type, fileUrl: file(`res-extra-${resourceRows.length}.pdf`), createdBy: pick(creators)._id, isActive: true, accessType: resourceRows.length % 4 === 0 ? 'paid' : 'free', price: resourceRows.length % 4 === 0 ? 6.99 : 0, currency: 'USD', isDownloadable: true, createdAt: ago(int(3, 200)) });
  }
  await put(Resource, resourceRows);
  const paidRes = resourceRows.filter((r) => r.accessType === 'paid' && r.isActive);
  const purchaseRows = [];
  const buyRes = (u, r, daysAgo) => {
    const tutorCreator = sid(r.createdBy) !== sid(admin);
    const createdAt = ago(daysAgo);
    const p = { _id: oid(), payerUserId: u._id, beneficiaryUserId: tutorCreator ? r.createdBy : undefined, resourceId: r._id, amount: r.price, currency: r.currency, method: 'manual', status: 'paid', description: `Resource: ${r.title.slice(0, 80)}`, paidAt: new Date(+createdAt + 6e5), createdAt, updatedAt: createdAt };
    payments.push(p);
    purchaseRows.push({ userId: u._id, resourceId: r._id, paymentId: p._id, createdAt });
  };
  paidRes.slice(0, 5).forEach((r, i) => buyRes(S, r, 5 + i * 6));
  paidRes.slice(5, 7).forEach((r, i) => buyRes(A, r, 8 + i));
  paidRes.slice(0, 3).forEach((r, i) => buyRes(newStudents[i], r, 12 + i));
  await put(ResourcePurchase, purchaseRows);
  // A pending resource invoice (checkout not finished)
  payments.push({ _id: oid(), payerUserId: S._id, beneficiaryUserId: paidRes[6]?.createdBy, resourceId: paidRes[6]?._id, amount: paidRes[6]?.price || 9.99, currency: 'USD', method: 'manual', status: 'pending', description: `Resource: ${(paidRes[6]?.title || 'Resource').slice(0, 80)}`, createdAt: ago(0, 6), updatedAt: ago(0, 6) });
  await put(ResourceBookmark, [...resourceRows.filter((r) => r.isActive).slice(0, 9).map((r, i) => ({ userId: S._id, resourceId: r._id, createdAt: ago(i + 1) })), ...resourceRows.slice(10, 14).map((r) => ({ userId: A._id, resourceId: r._id, createdAt: ago(4) }))]);
  const revRows = [];
  const revUsers = [S, A, R, ...newStudents.slice(0, 12)];
  resourceRows.slice(0, 20).forEach((r, i) => {
    shuffle(revUsers).slice(0, int(0, 5)).forEach((u) => {
      revRows.push({ resourceId: r._id, userId: u._id, rating: pick([5, 5, 4, 4, 3, 2]), comment: pick(['Exactly what I needed before the mock.', 'Clear and concise.', 'A couple of typos in Q4 but otherwise great.', 'Markscheme comments are gold.', '', 'Would love more HL-level questions.']), createdAt: ago(int(1, 60)) });
    });
    void i;
  });
  await put(ResourceReview, revRows);
  await put(ResourceSuggestion, [
    { resourceId: resourceRows[0]._id, userId: S._id, body: 'Could you add a worked example with air resistance on page 2?', status: 'open', createdAt: ago(3) },
    { resourceId: resourceRows[8]._id, userId: A._id, body: 'Question 5 references the old syllabus numbering.', status: 'reviewed', createdAt: ago(12) },
    { resourceId: resourceRows[15]._id, userId: newStudents[3]._id, body: 'Please include the 2025 markscheme changes for evaluation questions.', status: 'open', createdAt: ago(1) },
  ]);
  console.log(`Resources: +${resourceRows.length}  Purchases: +${purchaseRows.length}  Resource reviews: +${revRows.length}`);

  // ── Homework + submissions + progress ─────────────────────────────────────
  const hwRows = [];
  const subRows = [];
  const progRows = [];
  const tutorFor = (key) => (key === 'T' ? T : newTutors[key].user);
  const bookingFor = (stu, tutor, subj) =>
    bookings.filter((b) => sid(b.studentUserId) === sid(stu) && sid(b.tutorUserId) === sid(tutor) && sid(b.subjectId) === sid(subj) && b.status === 'completed').sort((a, b) => b.startAt - a.startAt)[0];
  const HW_DESC = (title) => `${title}.\n\nShow full working for every question; state units and significant figures. Upload a single PDF (scans are fine). Questions marked ★ are HL-only stretch questions.`;
  function mkHw(stu, o) {
    const _id = oid();
    const tutor = tutorFor(o.tutor || 'T');
    const subj = o.subject;
    const deadline = o.due >= 0 ? fromNow(o.due, 6) : ago(-o.due, 3);
    const createdAt = new Date(Math.min(+deadline - 7 * 864e5, NOW - 864e5));
    const b = o.linkBooking !== false ? bookingFor(stu, tutor, subj) : null;
    const scheme = o.scheme || 'ib_1_7';
    const maxScore = scheme === 'marks' ? o.max || 40 : scheme === 'ib_1_7' ? 7 : scheme === 'percentage' ? 100 : undefined;
    hwRows.push({
      _id,
      tutorUserId: tutor._id,
      studentUserId: stu._id,
      subjectId: subj._id,
      bookingId: b?._id,
      level: levelOf(subj),
      title: o.title,
      description: o.long ? HW_DESC(o.title) + '\n\n' + 'Context: this task builds directly on the last three sessions. Re-read your class notes and the examiner report extract before starting. '.repeat(4) : HW_DESC(o.title),
      deadline,
      resourceIds: resourceRows.filter((r) => sid(r.subjectId) === sid(subj)).slice(0, 2).map((r) => r._id),
      attachments: o.noAtt ? [] : [pdfAtt(`hw-${o.title.toLowerCase().replace(/[^a-z]+/g, '-').slice(0, 40)}.pdf`)],
      rubric: o.rubric || 'Method marks (M), accuracy marks (A), and one communication mark for units/sig figs.',
      gradingScheme: scheme,
      maxScore,
      status: o.status,
      createdAt,
      updatedAt: o.status === 'assigned' ? createdAt : new Date(Math.min(+deadline, NOW - 36e5)),
    });
    if (['submitted', 'graded'].includes(o.status)) {
      const versions = o.versions || 1;
      const submittedAt = new Date(Math.min(+deadline - 36e5 * int(2, 30), NOW - 2 * 36e5));
      const history = [];
      for (let v = 1; v < versions; v += 1) {
        history.push({ files: [pdfAtt(`submission-v${v}.pdf`)], notes: v === 1 ? 'First attempt — stuck on Q4.' : 'Fixed the units in Q2 and redid Q4.', submittedAt: new Date(+submittedAt - (versions - v) * 864e5) });
      }
      const sub = {
        assignmentId: _id,
        studentUserId: stu._id,
        files: [pdfAtt(`submission-v${versions}.pdf`), ...(o.photo ? [imgAtt('working-photo.png')] : [])],
        notes: o.notes || (versions > 1 ? `Final version (v${versions}). I reworked the last two questions after your comments.` : 'Attempted all questions. Not sure about the last part.'),
        versionHistory: history,
        createdAt: history[0]?.submittedAt || submittedAt,
        updatedAt: submittedAt,
      };
      if (o.status === 'graded') {
        const grade = normalizeGrade({ value: o.grade }, scheme, maxScore);
        const gradedAt = new Date(Math.min(+submittedAt + 2 * 864e5, NOW - 36e5));
        Object.assign(sub, { grade, feedback: o.feedback, gradedAt, updatedAt: gradedAt });
        progRows.push({ studentUserId: stu._id, subjectId: subj._id, topic: o.title, metricType: 'homework', scoreLabel: grade.label, scoreValue: grade.ibEquivalent, hours: 0, meta: { assignmentId: String(_id) }, createdAt: gradedAt });
      }
      subRows.push(sub);
    }
    return _id;
  }
  const sHw = [
    { title: 'Kinematics: SUVAT & projectile motion problem set', subject: phys, status: 'assigned', due: 1 },
    { title: 'Organic chemistry: SN1/SN2 mechanism drill (curly arrows)', subject: chem, status: 'assigned', due: 3, scheme: 'percentage' },
    { title: 'TOK essay: outline for prompt 4 (May 2027)', subject: tok, tutor: 'charlotte', status: 'assigned', due: 12, scheme: 'letter' },
    { title: 'Kinematics graphs — review worksheet', subject: phys, status: 'assigned', due: 6, long: true },
    { title: 'Extended Essay (Physics): Investigating the relationship between the length of a simple pendulum and its period, accounting for large-angle corrections and air resistance — full first draft with data analysis', subject: ee, status: 'assigned', due: 20, scheme: 'pass_fail', noAtt: true },
    { title: 'Math AA HL: integration by parts & substitution', subject: mathAA, status: 'overdue', due: -2, scheme: 'marks', max: 40 },
    { title: 'Economics: elasticity diagrams (PED/YED)', subject: econ, tutor: 'layla', status: 'overdue', due: -5, scheme: 'percentage' },
    { title: 'Statistics: normal distribution practice', subject: mathAA, status: 'assigned', due: -1 },
    { title: 'Physics IA: research question & methodology draft', subject: phys, status: 'submitted', due: -1, versions: 3, photo: true },
    { title: 'Chemistry: Hess\'s law & Born–Haber cycles', subject: chem, status: 'submitted', due: 2, versions: 2, scheme: 'marks', max: 30 },
    { title: 'Math AA HL: proof by induction — 8 questions', subject: mathAA, status: 'graded', due: -9, grade: 6, feedback: 'Excellent structure in every induction step. Q7: state the n = k+1 assumption explicitly to secure the R1 mark.' },
    { title: 'Physics Paper 1 MCQ: thermal physics (30 Qs)', subject: phys, status: 'graded', due: -12, scheme: 'percentage', grade: 83, feedback: '25/30 — the four misses were all latent-heat unit conversions. Redo Q11, 14, 22, 27.' },
    { title: 'Math AA HL Paper 2 mock: calculus section', subject: mathAA, status: 'graded', due: -16, scheme: 'marks', max: 40, grade: 34, feedback: 'Strong. Lost marks on the optimisation domain check (Q6b) and an arithmetic slip in Q9.', versions: 2 },
    { title: 'TOK exhibition: object commentary #2', subject: tok, tutor: 'charlotte', status: 'graded', due: -20, scheme: 'letter', grade: 'A', feedback: 'Compelling link between the object and IA prompt 7. Tighten the justification paragraph.' },
    { title: 'EE: annotated bibliography (15 sources)', subject: ee, status: 'graded', due: -24, scheme: 'pass_fail', grade: 'pass', feedback: 'Good range of peer-reviewed sources. Add access dates for the web references.' },
    { title: 'Organic chemistry: SN1/SN2 — stereochemistry follow-up', subject: chem, status: 'graded', due: -27, grade: 3, feedback: 'Inversion of configuration in SN2 is still confused with racemisation in SN1 — we will revisit next class.' },
    { title: 'Electromagnetic induction: Faraday & Lenz short answers', subject: phys, status: 'graded', due: -33, scheme: 'letter', grade: 'D', feedback: 'Direction of induced current consistently reversed. Practise with the right-hand grip rule worksheet.' },
    { title: 'Computer Science: OOP class design (UML)', subject: cs, tutor: 'weijie', status: 'graded', due: -14, scheme: 'pass_fail', grade: 'fail', feedback: 'Inheritance hierarchy missing; resubmit with the abstract Vehicle class.' },
    { title: 'Economics Paper 1 practice: market failure essay', subject: econ, tutor: 'layla', status: 'graded', due: -8, scheme: 'percentage', grade: 71, feedback: 'Good diagrams; evaluation needs a clearer judgement.' },
  ];
  const sHwIds = sHw.map((h) => mkHw(S, h));
  const aHw = [
    { title: 'Biology: cell respiration — stages summary table', subject: bio, status: 'assigned', due: 2 },
    { title: 'Biology: enzyme kinetics graph analysis', subject: bio, status: 'submitted', due: -1, versions: 2 },
    { title: 'Biology Paper 2 practice: photosynthesis', subject: bio, status: 'graded', due: -10, scheme: 'percentage', grade: 76, feedback: 'Well explained; add limiting-factor graph labels.' },
    { title: 'Biology: membrane transport flashcards', subject: bio, status: 'graded', due: -17, grade: 5, feedback: 'Solid — active vs passive distinctions are clear.' },
    { title: 'Biology: genetics crosses worksheet', subject: bio, status: 'overdue', due: -3 },
    { title: 'Chemistry: titration calculations', subject: chem, tutor: 'meera', status: 'graded', due: -6, scheme: 'marks', max: 25, grade: 19, feedback: 'Concordant titres handled well.' },
  ];
  aHw.forEach((h) => mkHw(A, h));
  const rHw = [
    { title: 'Economics: externalities diagram set', subject: econ, status: 'assigned', due: 4 },
    { title: 'Economics IA commentary draft', subject: econ, status: 'submitted', due: -2, versions: 1 },
    { title: 'Economics: market structures quiz', subject: econ, status: 'graded', due: -12, grade: 4, feedback: 'Monopolistic competition long-run equilibrium needs work.' },
    { title: 'Economics: elasticity calculations', subject: econ, status: 'graded', due: -18, scheme: 'letter', grade: 'B', feedback: 'Accurate maths; interpret the sign of YED.' },
    { title: 'Math AI SL: linear regression task', subject: SUBJ('Mathematics AI SL'), tutor: 'arjunk', status: 'overdue', due: -4 },
  ];
  rHw.forEach((h) => mkHw(R, h));
  // To-grade queue for the demo tutor (other students)
  [[Sara, phys, 'Momentum & impulse: collision problems'], [Liam, chem, 'Equilibrium: Kc calculations'], [Omar, mathAA, 'Complex numbers: De Moivre'], [Maya, phys, 'Circular motion worksheet'], [newStudents[1], phys, 'Projectile motion lab write-up'], [newStudents[8], mathAA, 'Sequences & series drill']].forEach(([stu, subj, title], i) =>
    mkHw(stu, { title, subject: subj, status: i % 3 === 2 ? 'graded' : 'submitted', due: -int(1, 6), grade: 5, feedback: 'Good work.', versions: 1 + (i % 2) })
  );
  await put(Assignment, hwRows);
  await put(Submission, subRows);

  // Hours logs (8 weeks), mocks, and a few general records
  const hoursTopics = { [sid(phys)]: ['Kinematics', 'Fields', 'IA data analysis', 'SHM'], [sid(mathAA)]: ['Integration', 'Proof by induction', 'Complex numbers', 'Vectors'], [sid(chem)]: ['Organic mechanisms', 'Energetics', 'Equilibrium'], [sid(econ)]: ['Elasticities', 'Macro objectives'], [sid(engB)]: ['Paper 1 text types', 'Oral practice'], [sid(tok)]: ['Essay planning', 'Exhibition'] };
  for (let w = 0; w < 8; w += 1) {
    for (let k = 0; k < 3; k += 1) {
      const subj = sSubjects[(w * 3 + k) % sSubjects.length];
      progRows.push({ studentUserId: S._id, subjectId: subj._id, topic: pick(hoursTopics[sid(subj)]), metricType: 'hours', scoreLabel: '', scoreValue: 0, hours: pick([0.5, 1, 1, 1.5, 2, 2.5]), meta: { source: 'self_log' }, createdAt: ago(w * 7 + k * 2 + 1, int(1, 10)) });
    }
  }
  [[phys, 'Physics Paper 2 mock (Sept)', 5], [mathAA, 'Math AA HL Paper 1 mock', 6], [chem, 'Chemistry Paper 1 mock', 4], [econ, 'Economics Paper 1 mock', 5], [engB, 'English B Paper 2 mock', 6], [tok, 'TOK essay draft (internal)', 6], [phys, 'Electromagnetic induction topic test', 3], [chem, 'Organic chemistry: SN1/SN2 quiz', 3]].forEach(([subj, topic, score], i) =>
    progRows.push({ studentUserId: S._id, subjectId: subj._id, topic, metricType: 'mock', scoreLabel: `${score}/7`, scoreValue: score, hours: 0, meta: { source: 'mock' }, createdAt: ago(5 + i * 6) })
  );
  for (const [stu, subjList] of [[A, [bio, chem]], [R, [econ, SUBJ('Mathematics AI SL')]]]) {
    for (let w = 0; w < 6; w += 1) progRows.push({ studentUserId: stu._id, subjectId: subjList[w % 2]._id, topic: 'Self study', metricType: 'hours', hours: pick([1, 1.5, 2]), createdAt: ago(w * 6 + 2) });
    subjList.forEach((s, i) => progRows.push({ studentUserId: stu._id, subjectId: s._id, topic: `${s.name} mock`, metricType: 'mock', scoreLabel: `${4 + i}/7`, scoreValue: 4 + i, createdAt: ago(10 + i) }));
  }
  await put(ProgressRecord, progRows);

  // Predicted grades (mirrors progress.service.refreshPredictedGrades) for S, A, R.
  const toIb = (avg) => (!avg || avg <= 0 ? null : avg >= 6.5 ? '7' : avg >= 5.5 ? '6' : avg >= 4.5 ? '5' : avg >= 3.5 ? '4' : avg >= 2.5 ? '3' : avg >= 1.5 ? '2' : '1');
  for (const stu of [S, A, R]) {
    const rows = await ProgressRecord.aggregate([
      { $match: { studentUserId: stu._id } },
      { $group: { _id: '$subjectId', avg: { $avg: { $cond: [{ $in: ['$metricType', ['hours', 'badge']] }, null, '$scoreValue'] } } } },
    ]);
    const predicted = {};
    rows.forEach((r) => {
      const g = toIb(r.avg);
      if (g) predicted[String(r._id)] = g;
    });
    await StudentProfile.updateOne({ userId: stu._id }, { $set: { predictedGrades: predicted } });
  }
  const badges = await Badge.find().lean();
  const haveBadge = new Set((await StudentBadge.find().lean()).map((b) => `${b.studentUserId}|${b.badgeId}`));
  const badgeRows = [];
  const award = (stu, name, daysAgo) => {
    const b = badges.find((x) => x.name === name);
    if (!b || haveBadge.has(`${stu._id}|${b._id}`)) return;
    haveBadge.add(`${stu._id}|${b._id}`);
    badgeRows.push({ studentUserId: stu._id, badgeId: b._id, awardedAt: ago(daysAgo), createdAt: ago(daysAgo) });
  };
  ['First Submission', 'Study Streak 3', 'Past Paper Pro', 'IA Starter', 'On Time', 'Perfect 7'].forEach((n, i) => award(S, n, 50 - i * 8));
  ['First Submission', 'On Time'].forEach((n, i) => award(A, n, 30 - i * 5));
  award(R, 'First Submission', 20);
  newStudents.slice(0, 10).forEach((u, i) => award(u, badges[i % 6].name, 10 + i));
  await put(StudentBadge, badgeRows);
  console.log(`Homework: +${hwRows.length}  Submissions: +${subRows.length}  Progress: +${progRows.length}  Badges awarded: +${badgeRows.length}`);

  // ── Payments: persist, then settle + build wallet ledgers ────────────────
  await put(Payment, payments.filter((p) => p.amount != null));
  const walletTx = [];
  const wallets = new Map(); // userId -> { wallet, currency }
  await WalletTransaction.deleteMany({});
  const baseWallets = await Wallet.find().lean();
  for (const w of baseWallets) wallets.set(w.ownerType === 'platform' ? 'platform' : sid(w.ownerUserId), w);
  const ensureWallet = async (userId, currency = 'USD') => {
    const key = sid(userId);
    if (wallets.has(key)) return wallets.get(key);
    const w = { _id: oid(), ownerType: 'user', ownerUserId: userId, balance: 0, currency, createdAt: ago(200) };
    await put(Wallet, [w]);
    wallets.set(key, w);
    return w;
  };
  const platform = wallets.get('platform');
  const endOfMonth = (d) => dayjs(d).endOf('month').toDate();
  const tx = (w, type, amount, description, refType, refId, at, extra = {}) =>
    walletTx.push({ walletId: w._id, type, amount: money(amount), description, refType, refId: String(refId || ''), cycle: extra.cycle ?? dayjs(at).format('YYYY-MM'), availableAt: extra.availableAt, createdAt: at, updatedAt: at });

  for (const u of [S, P, A, R]) await ensureWallet(u._id, 'USD');
  for (const t of Object.values(newTutors)) await ensureWallet(t.user._id, t.cur);
  // Top-ups
  [[S, 250, 56], [S, 200, 31], [S, 150, 9], [P, 500, 42], [P, 300, 11], [A, 100, 20], [R, 60, 15]].forEach(([u, amt, d]) =>
    tx(wallets.get(sid(u)), 'credit', amt, 'Wallet top-up (manual)', 'topup', u._id, ago(d), { availableAt: ago(d) })
  );

  const allSettled = await Payment.find({ status: { $in: ['paid', 'refunded'] } }).lean();
  const settleOps = [];
  for (const p of allSettled) {
    const paidAt = p.paidAt || p.createdAt;
    const tutorId = p.beneficiaryUserId ? sid(p.beneficiaryUserId) : null;
    const tutorAmt = tutorId ? money(p.amount * 0.75) : 0;
    const platformAmt = money(p.amount - tutorAmt);
    const settledAt = p.settledAt || new Date(+paidAt + 6e4);
    const patch = { settledAt, settlement: { tutorUserId: tutorId ? p.beneficiaryUserId : undefined, tutorAmt, platformAmt } };
    if (!p.paidAt) patch.paidAt = paidAt;
    if (p.status === 'refunded' && !p.refundedAt) patch.refundedAt = new Date(+paidAt + 2 * 864e5);
    settleOps.push({ updateOne: { filter: { _id: p._id }, update: { $set: patch } } });
    const kind = p.bookingId ? 'Lesson payout (75%)' : p.courseId ? 'Course sale payout (75%)' : p.projectId ? 'Project payout (75%)' : 'Resource sale payout (75%)';
    if (tutorId) {
      const tw = await ensureWallet(tutorId, p.currency);
      tx(tw, 'credit', tutorAmt, kind, 'payment', p._id, settledAt, { cycle: dayjs(settledAt).format('YYYY-MM'), availableAt: endOfMonth(settledAt) });
      tx(platform, 'credit', platformAmt, 'Platform commission (25%)', 'payment', p._id, settledAt);
    } else {
      tx(platform, 'credit', platformAmt, 'Platform revenue', 'payment', p._id, settledAt);
    }
    const payerW = wallets.get(sid(p.payerUserId));
    if (p.method === 'wallet' && payerW && payerW.currency === p.currency) {
      tx(payerW, 'debit', p.amount, `Paid: ${p.description}`, 'payment', p._id, new Date(+paidAt - 6e4));
    }
    if (p.status === 'refunded') {
      const at = patch.refundedAt || p.refundedAt;
      if (tutorId) tx(wallets.get(tutorId), 'debit', tutorAmt, `Refund — ${p.description}`, 'refund', p._id, at);
      tx(platform, 'debit', platformAmt, `Refund — ${p.description}`, 'refund', p._id, at);
      if (payerW && payerW.currency === p.currency) tx(payerW, 'credit', p.amount, `Refund — ${p.description}`, 'refund', p._id, at, { availableAt: at });
    }
  }
  if (settleOps.length) await Payment.bulkWrite(settleOps);
  // Keep payer wallets comfortably positive (top-up early in the history if the ledger dips).
  for (const u of [S, P, A, R]) {
    const w = wallets.get(sid(u));
    const net = walletTx.filter((t) => sid(t.walletId) === sid(w._id)).reduce((s2, t) => s2 + (t.type === 'credit' ? t.amount : -t.amount), 0);
    if (net < 120) tx(w, 'credit', Math.ceil(220 - net), 'Wallet top-up (bank transfer)', 'topup', u._id, ago(70), { availableAt: ago(70) });
  }

  // Bank accounts
  const aesKey = crypto.createHash('sha256').update(String(env.bankEncryptionKey)).digest();
  const encrypt = (num) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    const enc = Buffer.concat([cipher.update(String(num), 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
  };
  await BankAccount.deleteMany({ userId: T._id });
  const bank = (u, holder, num, ifsc, bankName, upi, status, extra = {}) => ({ _id: oid(), userId: u._id, holderName: holder, accountNumberEnc: encrypt(num), last4: num.slice(-4), ifsc, bankName, upiId: upi, status, providerRef: status === 'verified' ? `fav_${digits(10)}` : '', fundAccountId: status === 'verified' ? `fa_${digits(12)}` : '', verifiedAt: status === 'verified' ? ago(int(20, 200)) : undefined, createdAt: ago(int(30, 220)), ...extra });
  const banks = [
    bank(T, 'Demo Tutor', '50100234564321', 'HDFC0001234', 'HDFC Bank', 'demotutor@okhdfcbank', 'verified'),
    bank(nt.meera.user, 'Meera Raghavan', '002301556677', 'ICIC0000023', 'ICICI Bank', 'meera.r@okicici', 'verified'),
    bank(nt.arjunk.user, 'Arjun Kapoor', '918010045671234', 'UTIB0000004', 'Axis Bank', '', 'verified'),
    bank(nt.layla.user, 'Layla Hassan', '1015558822001', '', 'Emirates NBD', '', 'pending'),
    bank(nt.weijie.user, 'Ong Wei Jie', '0721234567', '', 'DBS Bank', '', 'unverified'),
    bank(nt.charlotte.user, 'Charlotte Hughes', '31926819', '', 'Barclays', '', 'failed', { failReason: 'Name mismatch: bank returned account holder "C HUGHES TUTORING LTD".' }),
    bank(nt.pieter.user, 'P. van Dijk', '417164300', '', 'ING Bank', '', 'verified'),
    bank(nt.matthieu.user, 'Matthieu Fontaine', '00762011623852957', '', 'UBS', '', 'unverified'),
  ];
  await put(BankAccount, banks);

  // Withdrawals: rebuild demo tutor history against the ledger.
  await Withdrawal.deleteMany({ tutorUserId: T._id });
  const tW = wallets.get(sid(T));
  const withdrawRows = [];
  const tutorLedgerAt = (w, at) => {
    let avail = 0;
    for (const t of walletTx) {
      if (sid(t.walletId) !== sid(w._id) || t.createdAt > at) continue;
      if (t.type === 'credit' && (!t.availableAt || t.availableAt <= at)) avail += t.amount;
      if (t.type === 'debit') avail -= t.amount;
    }
    return avail;
  };
  const windowDate = (monthsAgo, day = 29) => {
    const m = dayjs().subtract(monthsAgo, 'month');
    return m.date(Math.min(day, m.daysInMonth())).hour(11).minute(0).second(0).toDate();
  };
  const tBank = banks[0];
  const wd = (tutor, w, bankRow, at, status, frac, extra = {}) => {
    const avail = tutorLedgerAt(w, at);
    const amount = money(Math.max(0, Math.floor(avail * frac)));
    if (amount <= 0) return null;
    const row = { _id: oid(), tutorUserId: tutor._id, amount, currency: w.currency, status, adminNote: extra.adminNote || '', bankAccountId: bankRow?._id, cycle: dayjs(at).format('YYYY-MM'), payoutRef: status === 'approved' ? `pout_${digits(14)}` : '', createdAt: at, updatedAt: new Date(+at + 864e5) };
    withdrawRows.push(row);
    if (status === 'approved') tx(w, 'debit', amount, 'Withdrawal', 'withdrawal', row._id, new Date(+at + 864e5));
    return row;
  };
  wd(T, tW, tBank, windowDate(5), 'approved', 0.8, { adminNote: 'Paid out via IMPS' });
  wd(T, tW, tBank, windowDate(4), 'approved', 0.7, { adminNote: 'Paid out via IMPS' });
  wd(T, tW, tBank, windowDate(3, 29), 'rejected', 0.9, { adminNote: 'Bank holder name did not match PAN — please update and resubmit.' });
  wd(T, tW, tBank, windowDate(3, 30), 'approved', 0.6, { adminNote: 'Paid out after name correction' });
  wd(T, tW, tBank, windowDate(2), 'approved', 0.75, { adminNote: 'Paid out via NEFT' });
  const failedAt = windowDate(1);
  const pendingFailed = wd(T, tW, tBank, failedAt, 'pending', 0.6, { adminNote: 'Payout failed: Beneficiary bank timeout (NPCI U30) — retry scheduled' });
  if (pendingFailed) {
    tx(tW, 'debit', pendingFailed.amount, 'Withdrawal', 'withdrawal', pendingFailed._id, new Date(+failedAt + 864e5));
    tx(tW, 'credit', pendingFailed.amount, 'Withdrawal reversed (payout failed)', 'withdrawal', pendingFailed._id, new Date(+failedAt + 864e5 + 6e5), { availableAt: new Date(+failedAt + 864e5 + 6e5) });
  }
  const wdOther = [[nt.meera, 'pending', 1, 0.5], [nt.layla, 'pending', 1, 0.4], [nt.arjunk, 'approved', 2, 0.5], [nt.pieter, 'rejected', 1, 0.5], [nt.weijie, 'pending', 1, 0.3]];
  for (const [t, status, mAgo, frac] of wdOther) {
    const w = wallets.get(sid(t.user));
    const bk = banks.find((b) => sid(b.userId) === sid(t.user));
    wd(t.user, w, bk, windowDate(mAgo, 30), status, frac, { adminNote: status === 'rejected' ? 'Bank account not verified yet.' : status === 'approved' ? 'Paid out' : '' });
  }
  await put(Withdrawal, withdrawRows);
  await put(WalletTransaction, walletTx);
  // Balances from ledgers
  const sums = await WalletTransaction.aggregate([{ $group: { _id: '$walletId', c: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } }, d: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } } } }]);
  for (const s of sums) await Wallet.updateOne({ _id: s._id }, { $set: { balance: money(s.c - s.d) } });
  const tBal = sums.find((s) => sid(s._id) === sid(tW._id));
  console.log(`Wallet tx: ${walletTx.length} (demo tutor ${walletTx.filter((t) => sid(t.walletId) === sid(tW._id)).length}, balance ${money(tBal.c - tBal.d)} USD)  Withdrawals: +${withdrawRows.length}  Banks: +${banks.length}`);

  // ── Messages ───────────────────────────────────────────────────────────────
  const LINKS = ['https://phet.colorado.edu/en/simulations/projectile-motion', 'https://www.desmos.com/calculator', 'https://www.ibo.org/programmes/diploma-programme/curriculum/', 'https://docs.google.com/document/d/1demoIAfeedback/edit'];
  const STUDENT_LINES = [
    'Hi! Could we focus on past papers in the next class?',
    'I am stuck on question 4 of the {topic} worksheet — the answer in the markscheme is different from mine.',
    'Thank you, that explanation really helped 🙏',
    'Is it okay if I submit the homework tomorrow morning? I have a CAS event tonight.',
    'Could you send the notes from today?',
    'For the IA, is a range of five angles enough or should I go up to eight?',
    'I tried the timed paper — got 31/45. Most marks lost on {topic}.',
    'Quick question: does the formula booklet include the {topic} equation or do we need to memorise it?',
    'Here is my working for the last problem, I think I made a sign error somewhere.',
    'Can we move Thursday\'s class by 30 minutes? School assembly runs late.',
    'Long message incoming 😅 — I re-read the examiner report for May 2024 and it says most candidates lost marks for not stating assumptions. In my last mock I did exactly that in Q3 and Q7. I have now written a checklist: (1) state assumptions, (2) units on every line, (3) sig figs to match data, (4) one sentence of evaluation. Could you check if this is the right approach before the next mock?',
  ];
  const TUTOR_LINES = [
    'Absolutely — bring May 2023 TZ1, we will do Paper 2 Q2 and Q5.',
    'Good question. Check the sign convention: take "up" as positive and be consistent for every vector.',
    'Notes are attached. Focus on pages 3–5 before Thursday.',
    'That is fine, just submit by 9 am so I can mark it before class.',
    'Five angles is the minimum; seven to eight above 20° will make your trend much more convincing.',
    'Nice improvement! Next step: two timed Paper 2s per week until the mock.',
    'Here is a simulation that shows this nicely: {link}',
    'Reminder: tomorrow we start with a 5-minute retrieval quiz on {topic}.',
    'I have marked your submission — feedback is in the homework tab.',
    'Yes, 30 minutes later works. I have updated the booking.',
    'Your checklist is exactly right. Add one more point: re-read the command term (explain ≠ describe). With that, you are well on the way to a 6/7 on Paper 2.',
  ];
  const PARENT_LINES = [
    'Hello, how is {child} progressing in {subject}?',
    'Thank you for the session summary — very helpful.',
    'Could we add an extra class before the mocks?',
    '{child} was unwell yesterday, sorry for the missed class.',
    'Is the invoice for this month ready? I would like to pay via bank transfer.',
    'We are travelling over the half-term break; can we pause classes for two weeks?',
  ];
  const TUTOR_TO_PARENT = [
    '{child} is doing well — the last mock showed a clear jump in {subject}.',
    'Of course, I have two slots free next week. I will share them in the app.',
    'No problem at all, I hope {child} feels better. We can catch up on Saturday.',
    'The invoice is in the Payments tab; bank transfer is fine — please add the reference number.',
    'Sure — I will pause the series and resume after the break.',
  ];
  const convoKey = (a, b) => [sid(a), sid(b)].sort().join('|');
  const existingConvos = await Conversation.find().lean();
  const convoMap = new Map(existingConvos.map((c) => [c.participants.map(String).sort().join('|'), c]));
  const msgRows = [];
  const newConvos = [];
  const convoLast = new Map();
  function thread(a, b, n, o = {}) {
    const key = convoKey(a, b);
    let c = convoMap.get(key);
    if (!c) {
      c = { _id: oid(), participants: [a._id, b._id], lastMessageAt: ago(0), createdAt: ago(o.spanDays || 40) };
      convoMap.set(key, c);
      newConvos.push(c);
    }
    const span = (o.spanDays || 35) * 864e5;
    const endOffset = (o.endHoursAgo ?? int(1, 72)) * 36e5;
    const unreadTail = o.unread ?? int(0, 3);
    for (let i = 0; i < n; i += 1) {
      const at = new Date(NOW - endOffset - span * (1 - i / Math.max(1, n - 1)));
      const fromA = o.aFirst === false ? i % 2 === 1 : i % 2 === 0;
      const sender = chance(0.2) ? (fromA ? b : a) : fromA ? a : b;
      const receiver = sender === a ? b : a;
      const lines = o.lines(sender);
      let body = lines[(i + int(0, lines.length - 1)) % lines.length]
        .replace('{topic}', o.topic || 'kinematics')
        .replace('{subject}', o.subject || 'Physics')
        .replace(/\{child\}/g, o.child || 'Aanya')
        .replace('{link}', pick(LINKS));
      let kind = 'chat';
      let attachments = [];
      if (o.classLinks && i === Math.floor(n / 2) && o.tutor) {
        kind = 'class_links';
        const tools = classToolsFor(oid(), o.subject || 'Class');
        body = classToolsMessage({ subjectName: o.subject, startLabel: dayjs(at).add(2, 'day').tz(IST).format('ddd D MMM, HH:mm'), zoomJoin: `https://zoom.us/j/${meetDigits()}`, docsUrl: tools.docsUrl, whiteboardUrl: tools.whiteboardUrl });
        msgRows.push({ conversationId: c._id, senderId: o.tutor._id, kind, body, attachments, readBy: [o.tutor._id, (o.tutor === a ? b : a)._id], createdAt: at });
        continue;
      }
      if (o.feedback && i === n - 3 && o.student) {
        msgRows.push({ conversationId: c._id, senderId: o.student._id, kind: 'feedback', body: `Class feedback ${pick([5, 5, 4])}/5: ${pick(['Clear explanation of the chain rule.', 'Loved the past-paper walkthrough.', 'Really helpful IA feedback.'])}`, attachments: [], readBy: [o.student._id, (o.student === a ? b : a)._id], createdAt: at });
        continue;
      }
      if (i % 7 === 3) attachments = [{ url: file('demo-notes.pdf'), name: `${(o.topic || 'class').replace(/[^A-Za-z]+/g, '-')}-notes.pdf`, mimeType: 'application/pdf' }];
      if (i % 11 === 6) attachments = [{ url: file('working-photo.png'), name: 'my-working.png', mimeType: 'image/png' }];
      const unread = i >= n - unreadTail;
      msgRows.push({ conversationId: c._id, senderId: sender._id, kind, body, attachments, readBy: unread ? [sender._id] : [sender._id, receiver._id], createdAt: at });
    }
    if (o.flagged) {
      msgRows.push({ conversationId: c._id, senderId: a._id, kind: 'chat', body: 'Call me on ********** or email ********@*****.com so we can sort the fee directly.', flagged: true, flaggedHits: ['phone', 'email'], attachments: [], readBy: [a._id], createdAt: new Date(NOW - endOffset + 6e4) });
    }
    convoLast.set(sid(c._id), new Date(NOW - endOffset + (o.flagged ? 6e4 : 0)));
  }
  const sLines = (who) => (sid(who) === sid(S) || who.role === 'student' ? STUDENT_LINES : TUTOR_LINES);
  thread(S, T, 34, { lines: sLines, topic: 'Electromagnetic induction', subject: 'Physics', classLinks: true, tutor: T, feedback: true, student: S, spanDays: 50, endHoursAgo: 0.3, unread: 2 });
  [[nt.layla, 'Elasticities', 'Economics', 14], [nt.weijie, 'Recursion', 'Computer Science', 12], [nt.charlotte, 'TOK essay prompts', 'Theory of Knowledge', 22], [nt.pieter, 'Carbon cycle', 'ESS', 6], [nt.matthieu, 'Subjonctif', 'French', 5], [nt.grace, 'Memory models', 'Psychology', 8], [nt.meera, 'Organic chemistry: SN1/SN2', 'Chemistry', 18], [nt.arjunk, 'Integration', 'Math', 9]].forEach(([t, topic, subject, n], i) =>
    thread(S, t.user, n, { lines: (w) => (sid(w) === sid(S) ? STUDENT_LINES : TUTOR_LINES), topic, subject, classLinks: i % 2 === 0, tutor: t.user, student: S, feedback: i === 2, spanDays: 20 + i * 4, endHoursAgo: 4 + i * 20, unread: i % 3 })
  );
  thread(S, P, 16, { lines: () => ['Did you pay the Physics invoice?', 'Yes, from the wallet 👍', 'Remember the Chemistry homework is due tomorrow.', 'Can you book the Saturday Math class?', 'Done!', 'Pick me up at 6 after the studio class please.'], spanDays: 15, endHoursAgo: 30, unread: 1 });
  // Parent
  const pChild = (who) => (who.role === 'parent' ? PARENT_LINES : TUTOR_TO_PARENT);
  thread(P, T, 24, { lines: pChild, child: 'Aanya', subject: 'Biology', spanDays: 45, endHoursAgo: 2, unread: 2 });
  [[nt.meera, 'Aanya', 'Chemistry', 15], [nt.layla, 'Demo Student', 'Economics', 8], [nt.charlotte, 'Demo Student', 'TOK', 10], [nt.weijie, 'Demo Student', 'Computer Science', 6], [nt.arjunk, 'Rohan', 'Math AI', 12], [nt.pieter, 'Demo Student', 'ESS', 5], [nt.grace, 'Aanya', 'Psychology', 7]].forEach(([t, child, subject, n], i) =>
    thread(P, t.user, n, { lines: pChild, child, subject, spanDays: 15 + i * 5, endHoursAgo: 10 + i * 30, unread: i % 2 })
  );
  thread(P, A, 9, { lines: () => ['Have you finished the Biology homework?', 'Almost, just the last table.', 'Your class is at 7 tonight.', 'Ok mum!'], spanDays: 6, endHoursAgo: 20, unread: 0 });
  // Tutor (existing 10 convos get topped up; plus new students/parents)
  for (const stu of baseExtraStudents.slice(0, 8)) {
    thread(stu, T, int(4, 12), { lines: (w) => (sid(w) === sid(T) ? TUTOR_LINES : STUDENT_LINES), topic: pick(['Kinematics', 'Equilibrium', 'Integration', 'Circular motion']), subject: 'Physics', spanDays: int(10, 40), endHoursAgo: int(2, 200), unread: int(0, 2), classLinks: chance(0.5), tutor: T });
  }
  [newStudents[0], newStudents[1], newStudents[8], newStudents[16]].forEach((stu, i) =>
    thread(stu, T, 5 + i * 3, { lines: (w) => (sid(w) === sid(T) ? TUTOR_LINES : STUDENT_LINES), topic: 'Projectile motion', subject: 'Physics', spanDays: 12, endHoursAgo: 3 + i * 9, unread: i % 3 })
  );
  thread(newParents[7], T, 6, { lines: pChild, child: 'Aarav', subject: 'Physics', spanDays: 10, endHoursAgo: 50 });
  thread(newStudents[21], T, 3, { lines: (w) => (sid(w) === sid(T) ? TUTOR_LINES : STUDENT_LINES), spanDays: 30, endHoursAgo: 400, flagged: true });
  await put(Conversation, newConvos);
  await put(Message, msgRows);
  for (const [cid, last] of convoLast) await Conversation.updateOne({ _id: cid }, { $set: { lastMessageAt: last } });
  // Ensure base convos' lastMessageAt reflects their newest message.
  const lastAgg = await Message.aggregate([{ $group: { _id: '$conversationId', last: { $max: '$createdAt' } } }]);
  for (const r of lastAgg) await Conversation.updateOne({ _id: r._id }, { $set: { lastMessageAt: r.last } });
  console.log(`Conversations: +${newConvos.length}  Messages: +${msgRows.length}`);

  // ── Notifications ─────────────────────────────────────────────────────────
  const notifRows = [];
  const sBk = bookings.filter((b) => sid(b.studentUserId) === sid(S));
  const pick2 = (arr, i) => arr[i % arr.length];
  const sAssign = hwRows.filter((h) => sid(h.studentUserId) === sid(S));
  const sPays = payments.filter((p) => sid(p.payerUserId) === sid(S));
  const pPays = payments.filter((p) => sid(p.payerUserId) === sid(P));
  const tPays = payments.filter((p) => sid(p.beneficiaryUserId) === sid(T));
  const sProjects = projectRows.filter((p) => sid(p.studentUserId) === sid(S));
  const tProjects = projectRows.filter((p) => sid(p.tutorUserId) === sid(T));
  const childHw = hwRows.filter((h) => [sid(A), sid(R)].includes(sid(h.studentUserId)));
  const childBk = bookings.filter((b) => [sid(A), sid(R), sid(S)].includes(sid(b.studentUserId)));
  const tBk = bookings.filter((b) => sid(b.tutorUserId) === sid(T));
  const tHw = hwRows.filter((h) => sid(h.tutorUserId) === sid(T));
  const studentTemplates = [
    (i) => ({ type: 'booking', title: 'Booking confirmed', body: 'Your Physics HL class is confirmed. Join links are in Bookings.', meta: { bookingId: sid(pick2(sBk, i)) } }),
    (i) => ({ type: 'homework', title: 'New homework', body: `Assignment: ${pick2(sAssign, i).title}`, meta: { assignmentId: sid(pick2(sAssign, i)) } }),
    (i) => ({ type: 'grade', title: 'Homework graded', body: `${pick2(sAssign.filter((h) => h.status === 'graded'), i).title}: graded — see feedback`, meta: { assignmentId: sid(pick2(sAssign.filter((h) => h.status === 'graded'), i)) } }),
    (i) => ({ type: 'payment', title: 'Payment due', body: `${pick2(sPays, i).description} is waiting to be paid.`, meta: { paymentId: sid(pick2(sPays, i)) } }),
    (i) => ({ type: 'booking', title: 'Class coming up', body: 'Physics HL starts in 1 hour. The join button opens 15 minutes before.', meta: { bookingId: sid(soonS) } }),
    (i) => ({ type: 'message', title: 'New message', body: 'Demo Tutor: "Notes are attached. Focus on pages 3–5 before Thursday."', meta: { conversationId: sid(convoMap.get(convoKey(S, T))._id) } }),
    (i) => ({ type: 'project', title: 'Project delivered', body: `${pick2(sProjects, i).name} has a new deliverable.`, meta: { projectId: sid(pick2(sProjects, i)) } }),
    (i) => ({ type: 'payment', title: 'Payment received', body: 'Thank you! Your payment was confirmed.', meta: { paymentId: sid(pick2(sPays.filter((p) => p.status === 'paid'), i)), status: 'paid' } }),
    (i) => ({ type: 'booking', title: 'Reschedule request', body: 'Your tutor offered new times. Select a slot in the Scholaris app.', meta: { bookingId: sid(sMathOffer) } }),
    (i) => ({ type: 'support', title: 'Support ticket updated', body: 'Your ticket is now in_progress', meta: {} }),
    (i) => ({ type: 'academic', title: 'Predicted grade updated', body: 'Your Physics predicted grade moved from 5 to 6.', meta: {} }),
    (i) => ({ type: 'credit', title: 'Wallet top-up', body: 'USD 150.00 was added to your wallet.', meta: {} }),
    (i) => ({ type: 'system', title: 'Scheduled maintenance', body: 'Scholaris will be briefly unavailable on Sunday 02:00–02:30 IST.', meta: {} }),
    (i) => ({ type: 'attendance', title: 'Attendance recorded', body: 'You were marked absent for Physics HL. Contact your tutor if this is wrong.', meta: { bookingId: sid(sBk.find((b) => b.attendance === 'absent')) } }),
    (i) => ({ type: 'homework', title: 'Homework due soon', body: `${sAssign[0].title} is due tomorrow.`, meta: { assignmentId: sid(sAssign[0]) } }),
    (i) => ({ type: 'payment', title: 'Refund processed', body: 'Your refund for Physics HL was processed to your wallet.', meta: { paymentId: sid(sPays.find((p) => p.status === 'refunded') || sPays[0]) } }),
  ];
  const parentTemplates = [
    (i) => ({ type: 'booking', title: 'Class booked', body: 'Your child has a new upcoming class booking.', meta: { bookingId: sid(pick2(childBk, i)), studentUserId: sid(pick2(childBk, i).studentUserId) } }),
    (i) => ({ type: 'attendance', title: 'Attendance alert', body: 'Your child was marked absent for a class.', meta: { bookingId: sid(childBk.find((b) => b.attendance === 'absent')), studentUserId: sid(A) } }),
    (i) => ({ type: 'homework', title: 'New homework assigned', body: `Assignment: ${pick2(childHw, i).title}`, meta: { assignmentId: sid(pick2(childHw, i)), studentUserId: sid(pick2(childHw, i).studentUserId) } }),
    (i) => ({ type: 'grade', title: 'Grade update', body: `${pick2(childHw, i + 1).title}: graded`, meta: { assignmentId: sid(pick2(childHw, i + 1)), studentUserId: sid(pick2(childHw, i + 1).studentUserId) } }),
    (i) => ({ type: 'payment', title: 'Payment due', body: `${pick2(pPays, i).description} is waiting to be paid.`, meta: { paymentId: sid(pick2(pPays, i)) } }),
    (i) => ({ type: 'booking', title: 'Session summary', body: 'Worked through cell respiration and two past-paper questions. Strong session — ready for timed practice.', meta: { bookingId: sid(liveA), studentUserId: sid(A) } }),
    (i) => ({ type: 'academic', title: 'Weekly progress report', body: 'Aanya logged 4.5 study hours and completed 2 assignments this week.', meta: { studentUserId: sid(A) } }),
    (i) => ({ type: 'message', title: 'New message', body: 'Demo Tutor replied about Aanya\'s progress.', meta: {} }),
    (i) => ({ type: 'project', title: 'Project update', body: 'Biology IA method check is in progress.', meta: { projectId: sid(projectRows.find((p) => sid(p.studentUserId) === sid(A))), studentUserId: sid(A) } }),
    (i) => ({ type: 'payment', title: 'Payment failed', body: 'Economics HL (Rohan) — card declined. Please retry.', meta: { paymentId: sid(pPays.find((p) => p.status === 'failed') || pPays[0]), studentUserId: sid(R) } }),
    (i) => ({ type: 'support', title: 'Support ticket updated', body: 'Your ticket is now resolved', meta: {} }),
    (i) => ({ type: 'system', title: 'New: family dashboard', body: 'See all your children\'s classes, homework and payments in one view.', meta: {} }),
    (i) => ({ type: 'booking', title: 'Replacement tutor requested', body: 'Your request to move Aanya\'s Biology class to Dr. Meera Raghavan is awaiting her approval.', meta: { bookingId: sid(ab2), studentUserId: sid(A) } }),
  ];
  const tutorTemplates = [
    (i) => ({ type: 'booking', title: 'New booking', body: 'You have a new lesson booking.', meta: { bookingId: sid(pick2(tBk, i)) } }),
    (i) => ({ type: 'homework', title: 'Homework to grade', body: `${pick2(tHw.filter((h) => h.status === 'submitted'), i).title} has been submitted and is waiting for grading.`, meta: { assignmentId: sid(pick2(tHw.filter((h) => h.status === 'submitted'), i)) } }),
    (i) => ({ type: 'payment', title: 'Payout credited', body: `${pick2(tPays, i).description} — 75% credited to your wallet.`, meta: { paymentId: sid(pick2(tPays, i)) } }),
    (i) => ({ type: 'payment', title: 'Refund requested', body: 'A student requested a refund for a Physics HL class.', meta: { paymentId: sid(tPays.find((p) => p.refundRequest?.status === 'requested') || tPays[0]) } }),
    (i) => ({ type: 'booking', title: 'Reschedule request', body: 'A student asked to reschedule. Confirm your available slots in the Scholaris app.', meta: { bookingId: sid(sPhysReq) } }),
    (i) => ({ type: 'project', title: 'Project accepted', body: `${pick2(tProjects, i).name} was accepted and paid.`, meta: { projectId: sid(pick2(tProjects, i)) } }),
    (i) => ({ type: 'verification', title: 'Verification approved', body: 'Your documents were verified. Your profile is live.', meta: {} }),
    (i) => ({ type: 'message', title: 'New message', body: 'Demo Student: "Could you send the notes from today?"', meta: {} }),
    (i) => ({ type: 'support', title: 'Support ticket updated', body: 'Your ticket is now closed', meta: {} }),
    (i) => ({ type: 'system', title: 'Withdrawal window', body: 'Withdrawals open on days 29–31 of this month.', meta: {} }),
    (i) => ({ type: 'credit', title: 'Withdrawal update', body: 'Payout failed: beneficiary bank timeout. The amount was returned to your wallet.', meta: {} }),
    (i) => ({ type: 'booking', title: 'Class cancelled', body: 'Chemistry HL was cancelled by the student with notice. The slot is free again.', meta: { bookingId: sid(tBk.find((b) => b.status === 'cancelled')) } }),
    (i) => ({ type: 'attendance', title: 'Mark attendance', body: 'Biology HL with Aanya Kapoor ended — mark attendance and add a summary.', meta: { bookingId: sid(liveA) } }),
  ];
  const adminTemplates = [
    () => ({ type: 'verification', title: 'Verification pending', body: 'Nadia Petrova submitted documents for review.', meta: { tutorUserId: sid(nt.nadia.user) } }),
    () => ({ type: 'payment', title: 'Payment awaiting confirmation', body: 'A manual payment needs admin confirmation.', meta: {} }),
    () => ({ type: 'support', title: 'New support ticket', body: 'Wallet balance mismatch reported by a tutor.', meta: {} }),
    () => ({ type: 'payment', title: 'Refund disputed', body: 'Tutor disputed a refund request — review needed.', meta: {} }),
    () => ({ type: 'system', title: 'Payout failed', body: 'Withdrawal payout failed (NPCI U30). Retry from Withdrawals.', meta: {} }),
  ];
  const makeNotifs = (user, templates, count) => {
    for (let i = 0; i < count; i += 1) {
      const t = templates[i % templates.length](i);
      const hoursAgo = i < 5 ? i * 1.5 + 0.2 : i < 10 ? 24 + (i - 5) * 2 : 48 + ((i - 10) / (count - 10)) * (28 * 24);
      const unread = i < 6 || i % 4 === 1;
      Object.keys(t.meta).forEach((k) => t.meta[k] === 'undefined' && delete t.meta[k]);
      notifRows.push({ userId: user._id, title: t.title, body: t.body, type: t.type, meta: t.meta, isRead: !unread, createdAt: new Date(NOW - hoursAgo * 36e5) });
    }
  };
  makeNotifs(S, studentTemplates, 66);
  makeNotifs(P, parentTemplates, 64);
  makeNotifs(T, tutorTemplates, 65);
  makeNotifs(admin, adminTemplates, 30);
  makeNotifs(A, studentTemplates.slice(0, 4).map((f) => () => ({ ...f(0), meta: {} })), 12);
  await put(Notification, notifRows);
  console.log(`Notifications: +${notifRows.length}`);

  // ── Support tickets ───────────────────────────────────────────────────────
  const TICKETS = [
    ['booking', 'Join button did not appear for my 5:30 class', 'The class was confirmed but the join button stayed grey until 5:40.', 'Thanks — the meeting was provisioned late. We have added 15 minutes of credit.'],
    ['payment', 'Charged twice for Physics HL', 'My card shows two charges of USD 51 on the same day.', 'One charge was a pre-authorisation and has been released by your bank.'],
    ['general', 'How do I add my second child?', 'I want to link my son\'s account too.', 'Go to Children → Link child and enter his phone number.'],
    ['technical', 'Homework upload fails on iPad', 'Uploading a 12 MB PDF gives "Network error" every time.', 'Max upload size is 10 MB — please compress the PDF. We are raising the limit next sprint.'],
    ['tutor_dispute', 'Tutor ended class 20 minutes early', 'The class was cut short without explanation.', ''],
    ['complaint', 'Inappropriate message from another user', 'Someone shared contact details asking to pay outside the app.', 'Thank you for reporting. The account has been blacklisted.'],
    ['refund', 'Refund not received after 7 days', 'My refund was approved but not in my wallet yet.', 'Processed — please check your wallet ledger.'],
    ['verification', 'Verification stuck in pending', 'I submitted my documents 4 days ago.', 'Your references are not OTP-verified yet — please ask them to complete the SMS step.'],
  ];
  const ticketRows = [];
  const statuses = ['open', 'in_progress', 'resolved', 'closed'];
  const mkTickets = (u, idxs, startDays) =>
    idxs.forEach((ti, k) => {
      const [category, subject, description, reply] = TICKETS[ti];
      const status = statuses[k % 4];
      const createdAt = ago(startDays + k * 4);
      ticketRows.push({ userId: u._id, subject: k === 1 && u === S ? `${subject} — and the invoice still shows "pending" in the app even though my bank statement clearly shows the payment went through on the same evening` : subject, description: k === 0 ? `${description}\n\nSteps to reproduce:\n1. Open Bookings\n2. Tap the class card\n3. Wait — the button never turns active.\n\nDevice: iPhone 14, iOS 18, Safari.` : description, category, status, adminNote: status === 'open' ? '' : reply || 'We are looking into this and will update you within 24 hours.', createdAt, updatedAt: status === 'open' ? createdAt : new Date(+createdAt + 864e5) });
    });
  mkTickets(S, [0, 1, 3, 6, 2, 4], 1);
  mkTickets(P, [2, 1, 6, 4, 5, 0], 2);
  mkTickets(T, [7, 3, 1, 0, 6, 5], 1);
  [...newStudents.slice(0, 8), ...newParents.slice(0, 4), nt.nadia.user, nt.rahul.user].forEach((u, i) => {
    const [category, subject, description, reply] = TICKETS[i % TICKETS.length];
    const status = statuses[(i + 1) % 4];
    ticketRows.push({ userId: u._id, subject, description, category, status, adminNote: status === 'open' ? '' : reply, createdAt: ago(i * 2 + 1) });
  });
  await put(SupportTicket, ticketRows);

  // ── CMS: announcements, campaigns, configs ────────────────────────────────
  await put(Announcement, [
    { title: 'May 2027 exam timetable published', body: 'The IBO has released the May 2027 timetable. Tutors are running Paper 2 marathons every Saturday from January — book early.', audience: 'all', isActive: true, createdBy: admin._id, createdAt: ago(1) },
    { title: 'Mock season: book extra sessions', body: 'Most schools run mocks in November–December. Students who add one extra weekly session in the six weeks before mocks improve by 0.8 grades on average across our platform.', audience: 'student', isActive: true, createdBy: admin._id, createdAt: ago(3) },
    { title: 'New: replacement tutor flow', body: 'If your tutor cannot make a class, you can now request a verified replacement tutor at no extra charge from the booking card.', audience: 'parent', isActive: true, createdBy: admin._id, createdAt: ago(6) },
    { title: 'Tutor payouts move to UPI-first', body: 'From next month, payouts to Indian bank accounts use UPI where available for same-day settlement.', audience: 'tutor', isActive: true, createdBy: admin._id, createdAt: ago(8) },
    { title: 'Diwali break (expired)', body: 'Reduced availability between 20–26 Oct.', audience: 'all', isActive: false, createdBy: admin._id, createdAt: ago(370) },
    { title: 'Admin: weekly ops review moved to Thursday', body: 'Ops review now runs Thursdays 10:00 IST — bring refund and dispute metrics.', audience: 'admin', isActive: true, createdBy: admin._id, createdAt: ago(2) },
    { title: 'A very long announcement title to test wrapping on small screens: everything you need to know about Internal Assessment deadlines, extensions and the new submission checklist', body: 'Please read the full IA checklist in the Resources tab. '.repeat(6), audience: 'student', isActive: true, createdBy: admin._id, createdAt: ago(4) },
  ]);
  const CAMPAIGNS = [
    ['Google Search — "IB physics tutor"', 'paid_ads', 1850, 412, 63],
    ['Instagram Reels — exam tips', 'social', 920, 640, 41],
    ['Parent referral programme (Q3)', 'referral', 300, 158, 52],
    ['School fair: Dubai IB expo', 'events', 2400, 220, 34],
    ['Newsletter: mock-season offer', 'email', 120, 310, 27],
    ['Partner: UWCSEA alumni network', 'partner', 500, 95, 18],
    ['YouTube pre-roll — TOK essay', 'paid_ads', 1340, 280, 22],
    ['Organic SEO — resource library', 'organic', 0, 905, 71],
  ];
  await put(CampaignMetric, CAMPAIGNS.map(([name, channel, spend, leads, conversions], i) => ({ name, channel, spend, leads, conversions, notes: i % 3 === 0 ? 'Strong CPA; scale budget next quarter.' : '', periodStart: ago(30 * (i % 4) + 30), periodEnd: ago(30 * (i % 4)), createdBy: admin._id, createdAt: ago(30 * (i % 4)) })));
  for (const [key, value, description] of [
    ['cancel.noticeHours', 24, 'Notice required for a free cancellation'],
    ['reschedule.studentPerMonth', 1, 'Student-initiated reschedules per month'],
    ['homework.maxUploadMb', 10, 'Max homework upload size'],
    ['currency.supported', ['USD', 'INR', 'AED', 'GBP', 'SGD', 'EUR', 'CHF', 'HKD'], 'Currencies accepted for listings'],
    ['banner.maintenance', { enabled: false, message: 'Scheduled maintenance Sunday 02:00 IST' }, 'Global maintenance banner'],
    ['referral.bonusUsd', 15, 'Wallet credit for a successful referral'],
  ]) {
    await PlatformConfig.updateOne({ key }, { $setOnInsert: { key, value, description } }, { upsert: true });
  }

  // ── Favorites & blocks ────────────────────────────────────────────────────
  const favRows = [];
  const fav = (u, kind, target) => favRows.push({ userId: u._id, kind, targetId: target._id, createdAt: ago(int(1, 30)) });
  [T, nt.meera.user, nt.charlotte.user, nt.layla.user].forEach((t) => fav(S, 'tutor', t));
  tCourses.slice(0, 3).forEach((c) => fav(S, 'course', c));
  projectRows.filter((p) => p.openToJoin).slice(0, 2).forEach((p) => fav(S, 'project', p));
  resourceRows.slice(0, 5).forEach((r) => fav(S, 'resource', r));
  [T, nt.meera.user].forEach((t) => fav(P, 'tutor', t));
  fav(P, 'course', tCourses[5]);
  await put(FavoriteItem, favRows);
  await put(FavoriteTutor, [nt.meera.user, nt.charlotte.user, nt.layla.user].map((t) => ({ studentUserId: S._id, tutorUserId: t._id, createdAt: ago(10) })));
  await put(UserBlock, [
    { byUserId: S._id, targetUserId: nt.daniel.user._id, reason: 'Asked for payment outside the app.', createdAt: ago(20) },
    { byUserId: T._id, targetUserId: newStudents[21]._id, reason: 'Abusive messages.', createdAt: ago(16) },
    { byUserId: P._id, targetUserId: nt.samuel.user._id, reason: 'Not comfortable with this tutor.', createdAt: ago(9) },
  ]);

  // ── Files on disk ─────────────────────────────────────────────────────────
  const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
  if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGNk+M+AFTBhFx4UGlYMAI+nAhK3pJ4gAAAAAElFTkSuQmCC', 'base64');
  const pdf = (label) => {
    const text = label.replace(/[()\\]/g, ' ').slice(0, 60);
    const stream = `BT /F1 14 Tf 30 80 Td (${text}) Tj ET`;
    return `%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\ntrailer<< /Size 6 /Root 1 0 R >>\n%%EOF\n`;
  };
  const baseRes = await Resource.find({ fileUrl: /^\/uploads\// }).select('fileUrl').lean();
  baseRes.forEach((r) => files.add(r.fileUrl.replace('/uploads/', '')));
  let written = 0;
  for (const name of files) {
    const p = path.join(uploadRoot, name);
    if (fs.existsSync(p)) continue;
    fs.writeFileSync(p, name.endsWith('.png') ? PNG : pdf(`Scholaris demo - ${name}`));
    written += 1;
  }

  // ── Final consistency: refCodes ───────────────────────────────────────────
  const missingRef = await User.find({ $or: [{ refCode: { $exists: false } }, { refCode: '' }, { refCode: null }] });
  for (const u of missingRef) {
    u.refCode = refFor(u._id);
    await u.save();
  }

  console.log(`Files written: ${written} (in ${uploadRoot})`);
  console.log('\n[seed-rich] Collection counts:');
  const cols = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name).sort();
  for (const name of cols) {
    const n = await mongoose.connection.db.collection(name).countDocuments();
    console.log(`  ${name.padEnd(22)} ${n}`);
  }
  console.log('\n[seed-rich] Demo logins (OTP 123456): admin 9999999999 | tutor 8888888888 | student 7777777777 | parent 6666666666');
  console.log('[seed-rich] Empty states: student 7777700000 | parent 6666600000 | tutor without slots 8888800000');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  try {
    await require('mongoose').disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
