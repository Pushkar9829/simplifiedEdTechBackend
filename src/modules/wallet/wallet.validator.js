const Joi = require('joi');

const withdrawSchema = Joi.object({
  amount: Joi.number().positive().required(),
});

const reviewSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  adminNote: Joi.string().allow(''),
});

const topUpSchema = Joi.object({
  amount: Joi.number().positive().required(),
  userId: Joi.string().hex().length(24),
});

module.exports = { withdrawSchema, reviewSchema, topUpSchema };
