const User = require('./user.model');
const { StudentProfile, TutorProfile, ParentProfile } = require('./profile.model');

async function findById(id) {
  return User.findById(id);
}

async function findByPhone(phone) {
  return User.findOne({ phone });
}

async function findByEmail(email) {
  if (!email) return null;
  return User.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
}

async function create(data) {
  return User.create(data);
}

async function updateById(id, data) {
  return User.findByIdAndUpdate(id, data, { new: true });
}

async function list(filter = {}, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function ensureRoleProfile(userId, role) {
  if (role === 'student') {
    return StudentProfile.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true }
    );
  }
  if (role === 'tutor') {
    return TutorProfile.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true }
    );
  }
  if (role === 'parent') {
    return ParentProfile.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true }
    );
  }
  return null;
}

async function getStudentProfile(userId) {
  return StudentProfile.findOne({ userId }).populate('subjectIds').populate('boardId').populate('classLevelId');
}

async function getTutorProfile(userId) {
  return TutorProfile.findOne({ userId });
}

async function getParentProfile(userId) {
  return ParentProfile.findOne({ userId });
}

async function updateStudentProfile(userId, data) {
  return StudentProfile.findOneAndUpdate({ userId }, data, { new: true, upsert: true });
}

async function updateTutorProfile(userId, data) {
  return TutorProfile.findOneAndUpdate({ userId }, data, { new: true, upsert: true });
}

module.exports = {
  findById,
  findByPhone,
  findByEmail,
  create,
  updateById,
  list,
  ensureRoleProfile,
  getStudentProfile,
  getTutorProfile,
  getParentProfile,
  updateStudentProfile,
  updateTutorProfile,
};
