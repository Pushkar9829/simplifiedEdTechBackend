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
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    preferredCurrency: { type: String, default: '' },
    dateOfBirth: { type: Date },
    sex: { type: String, default: '' },
    blacklistReason: { type: String, default: '' },
    refCode: { type: String, trim: true, unique: true, sparse: true },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

module.exports = mongoose.model('User', userSchema);
