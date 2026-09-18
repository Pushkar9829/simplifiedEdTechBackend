const mongoose = require('mongoose');
const { ROLES, USER_STATUS } = require('../../common/constants');

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    role: { type: String, enum: Object.values(ROLES), required: true },
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '', index: true },
    googleId: { type: String, trim: true, default: '' },
    avatar: { type: String, default: '' },
    timezone: { type: String, default: 'UTC' },
    country: { type: String, default: '' },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
