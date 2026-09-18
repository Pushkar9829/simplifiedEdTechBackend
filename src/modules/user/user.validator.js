const Joi = require('joi');
const { USER_STATUS, ROLES } = require('../../common/constants');

const updateMeSchema = Joi.object({
  name: Joi.string().allow(''),
  email: Joi.string().email({ tlds: { allow: false } }).allow(''),
  avatar: Joi.string().allow(''),
  timezone: Joi.string(),
  country: Joi.string().allow(''),
  school: Joi.string().allow(''),
  gradeYear: Joi.string().allow(''),
  qualifications: Joi.string().allow(''),
  university: Joi.string().allow(''),
  degree: Joi.string().allow(''),
  experienceYears: Joi.number().min(0),
  languages: Joi.array().items(Joi.string()),
  bio: Joi.string().allow(''),
  hourlyRate: Joi.number().min(0),
  currency: Joi.string(),
  trialLessonAvailable: Joi.boolean(),
  teachingMode: Joi.string().valid('online', 'offline', 'both'),
  hourlyRateOnline: Joi.number().min(0),
  hourlyRateOffline: Joi.number().min(0),
  location: Joi.object({
    city: Joi.string().allow(''),
    area: Joi.string().allow(''),
    address: Joi.string().allow(''),
    lat: Joi.number(),
    lng: Joi.number(),
  }),
  boardId: Joi.string().hex().length(24).allow('', null),
  classLevelId: Joi.string().hex().length(24).allow('', null),
});

const adminStatusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(USER_STATUS)).required(),
});

const adminListQuerySchema = Joi.object({
  role: Joi.string().valid(...Object.values(ROLES)),
  status: Joi.string().valid(...Object.values(USER_STATUS)),
  search: Joi.string().allow(''),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

module.exports = { updateMeSchema, adminStatusSchema, adminListQuerySchema };
