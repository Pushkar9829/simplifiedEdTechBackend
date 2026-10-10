const Joi = require('joi');
const { PROJECT_STATUS } = require('../../common/constants');

const objectId = Joi.string().hex().length(24);

const createSchema = Joi.object({
  studentUserId: objectId.allow('', null),
  subjectId: objectId.allow('', null),
  openToJoin: Joi.boolean(),
  kind: Joi.string().valid('project', 'assignment'),
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  price: Joi.number().min(1).required(),
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
  price: Joi.number().min(1),
  currency: Joi.string().length(3).uppercase(),
  deliveryDate: Joi.date().iso(),
  openToJoin: Joi.boolean(),
  subjectId: objectId.allow('', null),
});

module.exports = { createSchema, statusSchema, updateSchema };
