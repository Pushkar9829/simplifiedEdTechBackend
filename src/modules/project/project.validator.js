const Joi = require('joi');
const { PROJECT_STATUS } = require('../../common/constants');

const objectId = Joi.string().hex().length(24);

const createSchema = Joi.object({
  studentUserId: objectId.required(),
  kind: Joi.string().valid('project', 'assignment'),
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  price: Joi.number().min(0),
  currency: Joi.string().length(3).uppercase(),
  deliveryDate: Joi.date().iso().required(),
});

const statusSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(PROJECT_STATUS))
    .required(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(1),
  description: Joi.string().allow(''),
  kind: Joi.string().valid('project', 'assignment'),
  price: Joi.number().min(0),
  currency: Joi.string().length(3).uppercase(),
  deliveryDate: Joi.date().iso(),
});

module.exports = { createSchema, statusSchema, updateSchema };
