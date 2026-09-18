const Joi = require('joi');
const { LEVELS } = require('../../common/constants');

const createAssignmentSchema = Joi.object({
  studentUserId: Joi.string().hex().length(24).required(),
  subjectId: Joi.string().hex().length(24).required(),
  level: Joi.string().valid(...LEVELS),
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  deadline: Joi.date().iso().required(),
  resourceIds: Joi.array().items(Joi.string().hex().length(24)),
  rubric: Joi.string().allow(''),
});

const gradeSchema = Joi.object({
  grade: Joi.string().required(),
  feedback: Joi.string().allow(''),
});

module.exports = { createAssignmentSchema, gradeSchema };
