const Joi = require('joi');
const { RESOURCE_TYPES, LEVELS } = require('../../common/constants');

const createResourceSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  subjectId: Joi.string().hex().length(24).required(),
  level: Joi.string().valid(...LEVELS),
  topic: Joi.string().allow(''),
  chapter: Joi.string().allow(''),
  academicYear: Joi.string().allow(''),
  type: Joi.string().valid(...RESOURCE_TYPES).required(),
  fileUrl: Joi.string().allow(''),
  isActive: Joi.boolean(),
});

module.exports = { createResourceSchema };
