const Joi = require('joi');
const { LEVELS } = require('../../common/constants');

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

module.exports = { createBookingSchema, rescheduleSchema, attendanceSchema };
