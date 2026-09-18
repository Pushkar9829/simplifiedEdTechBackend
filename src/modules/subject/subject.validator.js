const Joi = require('joi');
const { LEVELS } = require('../../common/constants');

const createSubjectSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().allow(''),
  levels: Joi.array().items(Joi.string().valid(...LEVELS)),
  category: Joi.string().allow(''),
  description: Joi.string().allow(''),
  isActive: Joi.boolean(),
});

const updateSubjectSchema = createSubjectSchema.fork(['name'], (s) => s.optional());

const selectSubjectsSchema = Joi.object({
  subjectIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
});

module.exports = { createSubjectSchema, updateSubjectSchema, selectSubjectsSchema };
