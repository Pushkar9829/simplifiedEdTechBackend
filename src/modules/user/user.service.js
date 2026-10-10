const userRepo = require('./user.repo');
const UserBlock = require('./block.model');
const User = require('./user.model');
const Booking = require('../booking/booking.model');
const { Payment } = require('../payment/payment.model');
const paymentRepo = require('../payment/payment.repo');
const tutorRepo = require('../tutor/tutor.repo');
const notificationService = require('../notification/notification.service');
const { notifyParentsOfStudent } = require('../../utils/parentNotify');
const { escapeRegex } = require('../../utils/regex');
const ApiError = require('../../common/ApiError');
const { USER_STATUS, BOOKING_STATUS, PAYMENT_STATUS } = require('../../common/constants');

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function gstStatus(gst = {}) {
  if (!gst.hasGst) return { ...gst, status: 'unverified' };
  const number = String(gst.number || '').replace(/\s/g, '').toUpperCase();
  if (!number) return { ...gst, number, status: 'unverified' };
  if (gst.type === 'GSTIN' || !gst.type) {
    return { ...gst, number, status: GSTIN.test(number) ? 'format_ok' : 'rejected' };
  }
  return { ...gst, number, status: number.length >= 5 ? 'format_ok' : 'rejected' };
}

// Fields only admins / the platform may set; never accepted from PATCH /users/me.
const PROTECTED_PROFILE_FIELDS = [
  '_id',
  'userId',
  'verificationStatus',
  'ratingAvg',
  'ratingCount',
  'isPremium',
  'premiumUntil',
  'premiumRank',
  'createdAt',
  'updatedAt',
  '__v',
];

// Users never set identity status themselves: a new/changed number goes back to review.
function withIdentityStatus(identity, current = {}) {
  const { status: _s, ...rest } = identity;
  const number = String(rest.number ?? current.number ?? '').trim();
  const sameNumber = number === String(current.number || '').trim();
  let status = 'unverified';
  if (number) status = sameNumber && current.status ? current.status : 'pending';
  return { ...rest, number, status };
}

// Keep the admin's GST review unless the number changes; then re-run the format check.
function withGstStatus(gst, current = {}) {
  const { status: _s, checkedAt: _c, portalNote: _p, ...rest } = gst;
  const checked = gstStatus(rest);
  const prevNumber = String(current.number || '').replace(/\s/g, '').toUpperCase();
  if (!current.status || checked.number !== prevNumber || !rest.hasGst) return checked;
  return {
    ...checked,
    status: current.status,
    checkedAt: current.checkedAt,
    portalNote: current.portalNote || '',
  };
}

function maskIdentity(identity = {}) {
  const number = String(identity.number || '');
  if (!number) return identity;
  return {
    ...identity,
    number: number.length <= 4 ? number : `${'*'.repeat(number.length - 4)}${number.slice(-4)}`,
  };
}

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
  const {
    name,
    email,
    avatar,
    timezone,
    country,
    countryId,
    preferredCurrency,
    dateOfBirth,
    sex,
    ...profileData
  } = payload;
  if (email) {
    const owner = await userRepo.findByEmail(email);
    if (owner && String(owner._id) !== String(userId)) {
      throw new ApiError(409, 'Email is already in use');
    }
  }
  PROTECTED_PROFILE_FIELDS.forEach((k) => delete profileData[k]);
  Object.keys(profileData).forEach((k) => {
    if (k.startsWith('$') || k.includes('.')) delete profileData[k];
  });

  const user = await userRepo.updateById(userId, {
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
    ...(avatar !== undefined && { avatar }),
    ...(timezone !== undefined && { timezone }),
    ...(country !== undefined && { country }),
    ...(countryId !== undefined && { countryId: countryId || null }),
    ...(preferredCurrency !== undefined && { preferredCurrency }),
    ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth || null }),
    ...(sex !== undefined && { sex }),
  });

  let profile = null;
  if (profileData.boardId === '') profileData.boardId = null;
  if (profileData.classLevelId === '') profileData.classLevelId = null;
  if (profileData.identity || profileData.gst) {
    let current = null;
    if (role === 'student') current = await userRepo.getStudentProfile(userId);
    if (role === 'tutor') current = await userRepo.getTutorProfile(userId);
    if (role === 'parent') current = await userRepo.getParentProfile(userId);
    if (profileData.identity) {
      profileData.identity = withIdentityStatus(profileData.identity, current?.identity || {});
    }
    if (profileData.gst) profileData.gst = withGstStatus(profileData.gst, current?.gst || {});
  }
  if (role === 'student' && Object.keys(profileData).length) {
    const allowed = [
      'school',
      'gradeYear',
      'boardId',
      'classLevelId',
      'dateOfBirth',
      'sex',
      'preferredCurrency',
      'introPageUrl',
      'whatsappNumber',
      'addresses',
      'emergencyContact',
      'identity',
    ];
    const patch = {};
    allowed.forEach((k) => {
      if (profileData[k] !== undefined) patch[k] = profileData[k];
    });
    if (Object.keys(patch).length) profile = await userRepo.updateStudentProfile(userId, patch);
    else profile = await userRepo.getStudentProfile(userId);
  }
  if (role === 'tutor' && Object.keys(profileData).length) {
    profile = await userRepo.updateTutorProfile(userId, profileData);
  }
  if (role === 'parent' && Object.keys(profileData).length) {
    const allowed = ['introPageUrl', 'whatsappNumber', 'emergencyContact', 'identity'];
    const patch = {};
    allowed.forEach((k) => {
      if (profileData[k] !== undefined) patch[k] = profileData[k];
    });
    if (Object.keys(patch).length) profile = await userRepo.updateParentProfile(userId, patch);
    else profile = await userRepo.getParentProfile(userId);
  }

  return { user, profile };
}

async function adminListUsers(query) {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.search) {
    const re = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ phone: re }, { name: re }];
  }
  return userRepo.list(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
}

async function assertAdminStatusChange(actorId, userId, status) {
  if (actorId && String(actorId) === String(userId)) {
    throw new ApiError(400, 'You cannot change your own account status');
  }
  if (status === USER_STATUS.ACTIVE) return;
  const target = await userRepo.findById(userId);
  if (!target) throw new ApiError(404, 'User not found');
  if (target.role !== 'admin') return;
  const otherActiveAdmins = await User.countDocuments({
    role: 'admin',
    status: USER_STATUS.ACTIVE,
    _id: { $ne: target._id },
  });
  if (!otherActiveAdmins) throw new ApiError(400, 'Cannot deactivate the last active admin');
}

async function adminSetStatus(userId, status, reason = '') {
  if (status === USER_STATUS.BLACKLISTED) return adminVoidUser(userId, reason, status);
  return applyStatus(userId, status, reason);
}

async function applyStatus(userId, status, reason = '') {
  const user = await userRepo.updateById(userId, {
    status,
    blacklistReason: status === USER_STATUS.BLACKLISTED ? reason : '',
  });
  if (!user) throw new ApiError(404, 'User not found');
  if (status === USER_STATUS.BLACKLISTED || status === USER_STATUS.SUSPENDED) {
    await notificationService.notify(
      userId,
      status === USER_STATUS.BLACKLISTED ? 'Account blocked' : 'Account suspended',
      reason || 'An admin updated your account status.',
      'system'
    );
  }
  return user;
}

async function adminVoidUser(userId, reason = '', status = USER_STATUS.SUSPENDED) {
  const user = await userRepo.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  const consumedReason = reason || 'Voided by admin';
  const bookings = await Booking.find({
    $or: [{ studentUserId: userId }, { tutorUserId: userId }, { bookedByUserId: userId }],
    status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.RESCHEDULED] },
    startAt: { $gte: new Date() },
  }).populate('subjectId', 'name');
  for (const b of bookings) {
    await Booking.updateOne({ _id: b._id }, { status: BOOKING_STATUS.CANCELLED, consumedReason });
    if (b.slotId) await tutorRepo.markSlotBooked(b.slotId, false);
    await paymentRepo.voidBookingPayments(b._id);

    const title = 'Class cancelled';
    const body = `${b.subjectId?.name || 'A class'} on ${new Date(b.startAt).toLocaleString()} was cancelled by the platform.`;
    const meta = { bookingId: b._id };
    const counterparts = [b.studentUserId, b.tutorUserId, b.bookedByUserId]
      .filter(Boolean)
      .map(String)
      .filter((id, i, all) => id !== String(userId) && all.indexOf(id) === i);
    await notificationService.notifyMany(
      counterparts.map((id) => ({ userId: id, title, body, type: 'booking', meta }))
    );
    if (String(b.studentUserId) !== String(userId)) {
      await notifyParentsOfStudent(b.studentUserId, title, body, 'booking', meta);
    }
  }
  await Payment.updateMany(
    {
      $or: [{ payerUserId: userId }, { beneficiaryUserId: userId }],
      status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.AWAITING_CONFIRMATION] },
    },
    { status: PAYMENT_STATUS.FAILED, adminNote: reason || 'Voided by admin' }
  );
  return applyStatus(userId, status || USER_STATUS.SUSPENDED, reason);
}

async function blockUser(byUserId, targetUserId, reason = '') {
  if (String(byUserId) === String(targetUserId)) throw new ApiError(400, 'You cannot block yourself');
  const target = await userRepo.findById(targetUserId);
  if (!target) throw new ApiError(404, 'User not found');
  return UserBlock.findOneAndUpdate(
    { byUserId, targetUserId },
    { byUserId, targetUserId, reason },
    { upsert: true, new: true }
  );
}

async function unblockUser(byUserId, targetUserId) {
  return UserBlock.findOneAndDelete({ byUserId, targetUserId });
}

async function listMyBlocks(byUserId, role) {
  const fields =
    role === 'student' || role === 'parent' ? 'name role refCode' : 'name role refCode phone';
  return UserBlock.find({ byUserId }).populate('targetUserId', fields);
}

async function isBlocked(a, b) {
  if (!a || !b) return false;
  const hit = await UserBlock.findOne({
    $or: [
      { byUserId: a, targetUserId: b },
      { byUserId: b, targetUserId: a },
    ],
  });
  return Boolean(hit);
}

module.exports = {
  getMe,
  updateMe,
  adminListUsers,
  adminSetStatus,
  adminVoidUser,
  assertAdminStatusChange,
  blockUser,
  unblockUser,
  listMyBlocks,
  isBlocked,
  maskIdentity,
};
