const progressRepo = require('./progress.repo');
const parentRepo = require('../parent/parent.repo');
const bookingRepo = require('../booking/booking.repo');
const homeworkRepo = require('../homework/homework.repo');
const userRepo = require('../user/user.repo');
const ApiError = require('../../common/ApiError');
const { ROLES } = require('../../common/constants');
const { dayjs } = require('../../utils/time');

function scoreToIbGrade(avg) {
  if (!Number.isFinite(avg) || avg <= 0) return null;
  if (avg >= 6.5) return '7';
  if (avg >= 5.5) return '6';
  if (avg >= 4.5) return '5';
  if (avg >= 3.5) return '4';
  if (avg >= 2.5) return '3';
  if (avg >= 1.5) return '2';
  return '1';
}

function rewardsFromRecords(records = []) {
  let credits = 0;
  let sum = 0;
  let n = 0;
  for (const r of records) {
    if (r.metricType === 'hours') continue;
    const v = Number(r.scoreValue || 0);
    if (v <= 0) continue;
    n += 1;
    sum += v;
    credits += v >= 6 ? 15 : v >= 5 ? 10 : v >= 4 ? 5 : 2;
  }
  const avg = n ? sum / n : 0;
  const stars = !n ? 0 : avg >= 6.5 ? 5 : avg >= 5.5 ? 4 : avg >= 4.5 ? 3 : avg >= 3.5 ? 2 : 1;
  const level =
    credits >= 200 ? 'Star' : credits >= 100 ? 'Achiever' : credits >= 50 ? 'Rising' : 'Starter';
  return { credits, stars, level, avgScore: avg };
}

async function touchStudyStreak(studentUserId) {
  const profile = await userRepo.getStudentProfile(studentUserId);
  const today = dayjs().format('YYYY-MM-DD');
  const last = profile?.lastActivityDate || '';
  let streak = profile?.studyStreak || 0;

  if (last === today) {
    return profile;
  }

  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  if (last === yesterday) streak += 1;
  else streak = 1;

  return userRepo.updateStudentProfile(studentUserId, {
    studyStreak: streak,
    lastActivityDate: today,
  });
}

async function refreshPredictedGrades(studentUserId) {
  const bySubject = await progressRepo.aggregateBySubject(studentUserId);
  const predicted = {};
  for (const row of bySubject) {
    const grade = scoreToIbGrade(row.avgScore);
    if (grade && row._id) predicted[String(row._id)] = grade;
  }
  return userRepo.updateStudentProfile(studentUserId, { predictedGrades: predicted });
}

async function recordGrade({ studentUserId, subjectId, topic, scoreLabel, scoreValue, source }) {
  const numeric = Number.isFinite(scoreValue) ? scoreValue : Number.parseFloat(scoreLabel);
  const record = await progressRepo.createRecord({
    studentUserId,
    subjectId,
    topic,
    metricType: source || 'homework',
    scoreLabel,
    scoreValue: Number.isFinite(numeric) ? numeric : 0,
  });
  await touchStudyStreak(studentUserId);
  await refreshPredictedGrades(studentUserId);
  return record;
}

async function myProgress(studentUserId) {
  const [records, bySubject, badges, profile] = await Promise.all([
    progressRepo.listRecords(studentUserId),
    progressRepo.aggregateBySubject(studentUserId),
    progressRepo.studentBadges(studentUserId),
    userRepo.getStudentProfile(studentUserId),
  ]);

  const weakTopics = records
    .filter((r) => r.scoreValue > 0 && r.scoreValue < 4)
    .map((r) => r.topic)
    .filter(Boolean);
  const strongTopics = records
    .filter((r) => r.scoreValue >= 6)
    .map((r) => r.topic)
    .filter(Boolean);
  const rewards = rewardsFromRecords(records);
  if (
    profile &&
    (profile.progressCredits !== rewards.credits ||
      profile.progressStars !== rewards.stars ||
      profile.progressLevel !== rewards.level)
  ) {
    await userRepo.updateStudentProfile(studentUserId, {
      progressCredits: rewards.credits,
      progressStars: rewards.stars,
      progressLevel: rewards.level,
    });
  }

  return {
    records,
    bySubject,
    badges,
    weakTopics: [...new Set(weakTopics)].slice(0, 10),
    strongTopics: [...new Set(strongTopics)].slice(0, 10),
    studyStreak: profile?.studyStreak || 0,
    predictedGrades: profile?.predictedGrades || {},
    credits: rewards.credits,
    stars: rewards.stars,
    level: rewards.level,
  };
}

async function assertCanViewStudentProgress(user, studentUserId) {
  if (user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.STUDENT && user.id === studentUserId) return;

  if (user.role === ROLES.PARENT) {
    const link = await parentRepo.findLink(user.id, studentUserId);
    if (link) return;
    throw new ApiError(403, 'Student not linked to this parent');
  }

  if (user.role === ROLES.TUTOR) {
    const [booking, homework] = await Promise.all([
      bookingRepo.list({ tutorUserId: user.id, studentUserId }, { page: 1, limit: 1 }),
      homeworkRepo.listAssignments({ tutorUserId: user.id, studentUserId }, { page: 1, limit: 1 }),
    ]);
    if (booking.total > 0 || homework.total > 0) return;
    throw new ApiError(403, 'No teaching relationship with this student');
  }

  throw new ApiError(403, 'Not allowed');
}

async function progressForStudent(user, studentUserId) {
  await assertCanViewStudentProgress(user, studentUserId);
  return myProgress(studentUserId);
}

async function addHours(studentUserId, body) {
  const record = await progressRepo.createRecord({
    studentUserId,
    subjectId: body.subjectId,
    topic: body.topic || '',
    metricType: 'hours',
    hours: body.hours || 0,
  });
  await touchStudyStreak(studentUserId);
  return record;
}

async function adminCreateBadge(data) {
  return progressRepo.createBadge(data);
}

async function listBadges() {
  return progressRepo.listBadges();
}

async function awardBadge(studentUserId, badgeId) {
  return progressRepo.awardBadge(studentUserId, badgeId);
}

module.exports = {
  recordGrade,
  myProgress,
  progressForStudent,
  addHours,
  adminCreateBadge,
  listBadges,
  awardBadge,
  touchStudyStreak,
  refreshPredictedGrades,
};
