const Joi = require('joi');
const { LEVELS, MEETING_STATUS, GRADING_SCHEMES } = require('../../common/constants');

const createBookingSchema = Joi.object({
  tutorUserId: Joi.string().hex().length(24).required(),
  subjectId: Joi.string().hex().length(24).required(),
  level: Joi.string().valid(...LEVELS),
  slotId: Joi.string().hex().length(24),
  startAt: Joi.date().iso(),
  endAt: Joi.date().iso(),
  timezone: Joi.string(),
  isRecurring: Joi.boolean(),
  recurrenceCount: Joi.number().integer().min(1).max(12),
  notes: Joi.string().allow(''),
  amount: Joi.number().min(0),
  studentUserId: Joi.string().hex().length(24),
  deliveryMode: Joi.string().valid('online', 'offline'),
})
  .or('slotId', 'startAt')
  .custom((value, helpers) => {
    if (!value.slotId && (!value.startAt || !value.endAt)) {
      return helpers.message('startAt and endAt are required when slotId is not provided');
    }
    if (!value.slotId && value.startAt && value.endAt) {
      if (new Date(value.endAt) <= new Date(value.startAt)) {
        return helpers.message('endAt must be after startAt');
      }
    }
    return value;
  });

const rescheduleSchema = Joi.object({
  startAt: Joi.date().iso().required(),
  endAt: Joi.date().iso().required(),
  timezone: Joi.string(),
});

const attendanceSchema = Joi.object({
  attendance: Joi.string().valid('pending', 'present', 'absent').required(),
});

const meetingStatusSchema = Joi.object({
  meetingStatus: Joi.string()
    .valid(MEETING_STATUS.SCHEDULED, MEETING_STATUS.LIVE, MEETING_STATUS.ENDED, MEETING_STATUS.NO_SHOW)
    .required(),
});

const reportSchema = Joi.object({
  summary: Joi.string().allow('').max(5000),
  topicsCovered: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string().allow('')),
  strengths: Joi.string().allow('').max(2000),
  weaknesses: Joi.string().allow('').max(2000),
  studentMood: Joi.string().valid('', 'engaged', 'neutral', 'distracted', 'anxious', 'confident'),
  understandingRating: Joi.number().integer().min(1).max(5).allow(null),
  homeworkCompletion: Joi.string().valid('', 'done', 'partial', 'not_done', 'none_assigned'),
  nextSteps: Joi.string().allow('').max(2000),
  privateNotes: Joi.string().allow('').max(5000),
  sharedWithParent: Joi.boolean(),
});

const completeSchema = Joi.object({
  report: reportSchema,
  assignment: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().allow(''),
    deadline: Joi.date().iso().required(),
    rubric: Joi.string().allow(''),
    gradingScheme: Joi.string().valid(...GRADING_SCHEMES),
    maxScore: Joi.number().positive(),
    resourceIds: Joi.array().items(Joi.string().hex().length(24)),
  }).allow(null),
});

module.exports = {
  createBookingSchema,
  rescheduleSchema,
  attendanceSchema,
  meetingStatusSchema,
  reportSchema,
  completeSchema,
};
