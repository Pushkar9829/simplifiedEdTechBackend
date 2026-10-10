const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const addHoursSchema = Joi.object({
  subjectId: objectId.required(),
  hours: Joi.number().min(0.1).max(24).required(),
  topic: Joi.string().allow('').max(200),
});

const awardBadgeSchema = Joi.object({
  studentUserId: objectId.required(),
  badgeId: objectId.required(),
});

module.exports = { addHoursSchema, awardBadgeSchema };
