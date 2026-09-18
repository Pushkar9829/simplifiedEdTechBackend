const userRepo = require('./user.repo');
const ApiError = require('../../common/ApiError');

async function getMe(userId, role) {
  const user = await userRepo.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  let profile = null;
  if (role === 'student') profile = await userRepo.getStudentProfile(userId);
  if (role === 'tutor') profile = await userRepo.getTutorProfile(userId);
  if (role === 'parent') profile = await userRepo.getParentProfile(userId);

  return { user, profile };
}

async function updateMe(userId, role, payload) {
  const { name, email, avatar, timezone, country, ...profileData } = payload;
  const user = await userRepo.updateById(userId, {
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(avatar !== undefined && { avatar }),
    ...(timezone !== undefined && { timezone }),
    ...(country !== undefined && { country }),
  });

  let profile = null;
  if (profileData.boardId === '') profileData.boardId = null;
  if (profileData.classLevelId === '') profileData.classLevelId = null;
  if (role === 'student' && Object.keys(profileData).length) {
    profile = await userRepo.updateStudentProfile(userId, profileData);
  }
  if (role === 'tutor' && Object.keys(profileData).length) {
    profile = await userRepo.updateTutorProfile(userId, profileData);
  }

  return { user, profile };
}

async function adminListUsers(query) {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { phone: new RegExp(query.search, 'i') },
      { name: new RegExp(query.search, 'i') },
    ];
  }
  return userRepo.list(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
}

async function adminSetStatus(userId, status) {
  const user = await userRepo.updateById(userId, { status });
  if (!user) throw new ApiError(404, 'User not found');
  return user;
}

module.exports = { getMe, updateMe, adminListUsers, adminSetStatus };
