const Joi = require('joi');

const linkSchema = Joi.object({
  studentPhone: Joi.string().min(8).max(20).required(),
  relationship: Joi.string().allow(''),
});

module.exports = { linkSchema };
