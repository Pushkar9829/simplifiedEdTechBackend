const Joi = require('joi');
const { LEVELS, VERIFICATION_DOC_FIELDS } = require('../../common/constants');

const offeringSchema = Joi.object({
  subjectId: Joi.string().hex().length(24).required(),
  level: Joi.string().valid(...LEVELS).required(),
  hourlyRate: Joi.number().min(0),
  onlineRate: Joi.number().min(0),
  offlineRate: Joi.number().min(0),
  currency: Joi.string().length(3).uppercase(),
  countryId: Joi.string().hex().length(24).allow(''),
  boardId: Joi.string().hex().length(24).allow(''),
  classLevelId: Joi.string().hex().length(24).allow(''),
});

const availabilitySchema = Joi.object({
  startAt: Joi.string().required(),
  endAt: Joi.string().required(),
  timezone: Joi.string().allow(''),
  deliveryMode: Joi.string().valid('online', 'offline'),
  countryId: Joi.string().hex().length(24).allow(''),
  location: Joi.object({
    label: Joi.string().allow(''),
    city: Joi.string().allow(''),
    area: Joi.string().allow(''),
    address: Joi.string().allow(''),
    lat: Joi.number(),
    lng: Joi.number(),
  }),
});

const videoSchema = Joi.object({
  title: Joi.string().required(),
  kind: Joi.string().valid('intro', 'sample'),
  fileUrl: Joi.string().allow(''),
});

const reviewVerificationSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  rejectReason: Joi.string().allow('').max(1000),
  adminNote: Joi.string().allow(''),
  documents: Joi.array().items(
    Joi.object({
      field: Joi.string().valid(...VERIFICATION_DOC_FIELDS).required(),
      docId: Joi.string().hex().length(24).required(),
      status: Joi.string().valid('approved', 'rejected', 'pending').required(),
      rejectReason: Joi.string().allow('').max(500),
    })
  ),
});

const referencesSchema = Joi.object({
  references: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().trim().min(2).required(),
        relation: Joi.string().allow('').max(100),
        phone: Joi.string()
          .trim()
          .pattern(/^\+?[0-9]{8,15}$/)
          .required()
          .messages({ 'string.pattern.base': 'Reference phone must be 8-15 digits' }),
        email: Joi.string().email().allow(''),
      })
    )
    .max(5)
    .required(),
});

const referenceOtpSchema = Joi.object({
  otp: Joi.string().trim().min(4).max(8).required(),
});

const studentReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('').max(1000),
});

const studentNoteSchema = Joi.object({
  studentUserId: Joi.string().hex().length(24).required(),
  note: Joi.string().min(1).required(),
  tags: Joi.array().items(Joi.string()),
});

const lessonPlanSchema = Joi.object({
  subjectId: Joi.string().hex().length(24).required(),
  title: Joi.string().required(),
  studentUserId: Joi.string().hex().length(24),
  objectives: Joi.string().allow(''),
  content: Joi.string().allow(''),
  resources: Joi.array().items(Joi.string()),
  scheduledFor: Joi.date().iso(),
  bookingId: Joi.string().hex().length(24),
  status: Joi.string().valid('draft', 'ready', 'completed'),
});

module.exports = {
  offeringSchema,
  availabilitySchema,
  reviewVerificationSchema,
  referencesSchema,
  referenceOtpSchema,
  studentReviewSchema,
  studentNoteSchema,
  lessonPlanSchema,
  videoSchema,
};
