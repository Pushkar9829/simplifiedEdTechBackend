const Joi = require('joi');
const { ROLES } = require('../../common/constants');

const sendOtpSchema = Joi.object({
  phone: Joi.string().min(8).max(20).required(),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string().min(8).max(20).required(),
  otp: Joi.string().length(6).required(),
  role: Joi.string().valid(...Object.values(ROLES)).required(),
  name: Joi.string().allow(''),
});

const googleSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  name: Joi.string().allow(''),
  role: Joi.string().valid(...Object.values(ROLES)).required(),
});

module.exports = { sendOtpSchema, verifyOtpSchema, googleSchema };
