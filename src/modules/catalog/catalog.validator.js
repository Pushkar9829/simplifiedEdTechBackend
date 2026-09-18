const Joi = require('joi');

const boardSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().allow(''),
  isActive: Joi.boolean(),
});

const classLevelSchema = Joi.object({
  name: Joi.string().required(),
  sortOrder: Joi.number(),
  isActive: Joi.boolean(),
});

module.exports = { boardSchema, classLevelSchema };
