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
    state: Joi.string().allow(''),
    area: Joi.string().allow(''),
    address: Joi.string().allow(''),
    lat: Joi.number(),
    lng: Joi.number(),
  }),
  boardId: Joi.string().hex().length(24).allow('', null),
  classLevelId: Joi.string().hex().length(24).allow('', null),
  countryId: Joi.string().hex().length(24).allow('', null),
  preferredCurrency: Joi.string().allow(''),
  dateOfBirth: Joi.date().iso().allow('', null),
  sex: Joi.string().allow(''),
  introPageUrl: Joi.string().allow(''),
  whatsappNumber: Joi.string().allow(''),
  needBasedClasses: Joi.boolean(),
  meetingProvider: Joi.string().allow(''),
  addresses: Joi.array().items(Joi.object().unknown(true)),
  currentAddress: Joi.object().unknown(true),
  permanentAddress: Joi.object().unknown(true),
  emergencyContact: Joi.object({
    name: Joi.string().allow(''),
    relationship: Joi.string().allow(''),
    phone: Joi.string().allow(''),
    email: Joi.string().allow(''),
  }),
  identity: Joi.object({
    type: Joi.string().allow(''),
    number: Joi.string().allow(''),
    documentUrl: Joi.string().allow(''),
  }),
  gst: Joi.object({
    hasGst: Joi.boolean(),
    type: Joi.string().allow(''),
    number: Joi.string().allow(''),
    legalName: Joi.string().allow(''),
    registeredAddress: Joi.string().allow(''),
    certificateUrl: Joi.string().allow(''),
  }),
});

const blockSchema = Joi.object({
  targetUserId: Joi.string().hex().length(24).required(),
  reason: Joi.string().allow(''),
});

const adminStatusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(USER_STATUS)).required(),
  reason: Joi.string().allow(''),
  voidOpen: Joi.boolean(),
});

const adminListQuerySchema = Joi.object({
  role: Joi.string().valid(...Object.values(ROLES)),
  status: Joi.string().valid(...Object.values(USER_STATUS)),
  search: Joi.string().allow(''),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

module.exports = { updateMeSchema, adminStatusSchema, adminListQuerySchema, blockSchema };
