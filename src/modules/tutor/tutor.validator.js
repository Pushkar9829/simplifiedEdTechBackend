const Joi = require('joi');
const { LEVELS } = require('../../common/constants');

const offeringSchema = Joi.object({
  subjectId: Joi.string().hex().length(24).required(),
  level: Joi.string().valid(...LEVELS).required(),
  hourlyRate: Joi.number().min(0),
  onlineRate: Joi.number().min(0),
  offlineRate: Joi.number().min(0),
  boardId: Joi.string().hex().length(24),
  classLevelId: Joi.string().hex().length(24),
});

const availabilitySchema = Joi.object({
  startAt: Joi.string().required(),
  endAt: Joi.string().required(),
  timezone: Joi.string().default('UTC'),
  deliveryMode: Joi.string().valid('online', 'offline'),
});

const videoSchema = Joi.object({
  title: Joi.string().required(),
  kind: Joi.string().valid('intro', 'sample'),
  fileUrl: Joi.string().allow(''),
});

const reviewVerificationSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  adminNote: Joi.string().allow(''),
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
  studentReviewSchema,
  studentNoteSchema,
  lessonPlanSchema,
  videoSchema,
};
