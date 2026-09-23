const Joi = require('joi');
const { COURSE_STATUS, LEVELS } = require('../../common/constants');

const objectId = Joi.string().hex().length(24);
const idList = Joi.alternatives().try(
  Joi.array().items(objectId),
  objectId.custom((v) => [v])
);

const courseSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  subjectId: objectId.required(),
  level: Joi.string().valid(...LEVELS),
  countryId: objectId.allow(''),
  price: Joi.number().min(0),
  currency: Joi.string().length(3).uppercase(),
  lessonPlanIds: idList,
  status: Joi.string().valid(...Object.values(COURSE_STATUS)),
});

const coursePatchSchema = courseSchema.fork(['title', 'subjectId'], (s) => s.optional());

const enrollSchema = Joi.object({
  studentUserId: objectId,
});

module.exports = { courseSchema, coursePatchSchema, enrollSchema };
