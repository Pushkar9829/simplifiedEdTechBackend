const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const ApiError = require('../../common/ApiError');
const { ROLES } = require('../../common/constants');
const authRepo = require('./auth.repo');
const userRepo = require('../user/user.repo');

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, phone: user.phone },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

async function sendOtp({ phone }) {
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000);
  await authRepo.upsertOtp(phone, env.demoOtp, expiresAt);
  return {
    phone,
    message: 'OTP sent successfully',
    demoOtp: env.nodeEnv === 'development' ? env.demoOtp : undefined,
    expiresAt,
  };
}

async function verifyOtp({ phone, otp, role, name }) {
  if (!Object.values(ROLES).includes(role)) {
    throw new ApiError(400, 'Invalid role');
  }

  const session = await authRepo.findOtp(phone);
  if (!session) throw new ApiError(400, 'OTP not requested or expired');
  if (session.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, 'OTP expired');
  }
  if (otp !== env.demoOtp && otp !== session.code) {
    throw new ApiError(400, 'Invalid OTP');
  }

  let user = await userRepo.findByPhone(phone);
  if (!user) {
    user = await userRepo.create({
      phone,
      role,
      name: name || '',
      lastLoginAt: new Date(),
    });
  } else {
    if (user.role !== role && user.role !== ROLES.ADMIN) {
      throw new ApiError(409, `Phone already registered as ${user.role}`);
    }
    user = await userRepo.updateById(user._id, { lastLoginAt: new Date(), ...(name && { name }) });
  }

  await userRepo.ensureRoleProfile(user._id, user.role);
  await authRepo.deleteOtp(phone);

  const token = signToken(user);
  return { token, user };
}

async function logout() {
  return { message: 'Logged out. Discard the client token.' };
}

async function googleLogin({ email, name, role }) {
  if (!Object.values(ROLES).includes(role)) {
    throw new ApiError(400, 'Invalid role');
  }
  if (!email) throw new ApiError(400, 'Email is required');

  let user = await userRepo.findByEmail(email);
  if (!user) {
    const slug = String(email)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 12);
    user = await userRepo.create({
      phone: `g${slug}${Date.now().toString().slice(-5)}`.slice(0, 20),
      email,
      googleId: email,
      role,
      name: name || '',
      lastLoginAt: new Date(),
    });
  } else {
    if (user.role !== role && user.role !== ROLES.ADMIN) {
      throw new ApiError(409, `Email already registered as ${user.role}`);
    }
    user = await userRepo.updateById(user._id, {
      lastLoginAt: new Date(),
      ...(name && { name }),
    });
  }

  await userRepo.ensureRoleProfile(user._id, user.role);
  const token = signToken(user);
  return { token, user, provider: 'google' };
}

module.exports = { sendOtp, verifyOtp, logout, googleLogin, signToken };
