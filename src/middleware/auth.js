const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../common/ApiError');
const userRepo = require('../modules/user/user.repo');

async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Authentication required');

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await userRepo.findById(payload.userId);
    if (!user) throw new ApiError(401, 'Invalid or inactive user');
    if (user.status === 'blacklisted') {
      throw new ApiError(403, 'This account is blocked from the platform');
    }
    if (user.status !== 'active') {
      throw new ApiError(401, 'Invalid or inactive user');
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      phone: user.phone,
      name: user.name,
    };
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Invalid or expired token'));
    }
    next(err);
  }
}

function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden for this role'));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
