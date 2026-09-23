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

const bankAccountSchema = Joi.object({
  holderName: Joi.string().trim().min(2).required(),
  accountNumber: Joi.string().trim().allow(''),
  ifsc: Joi.string().trim().uppercase().allow(''),
  bankName: Joi.string().allow(''),
  upiId: Joi.string().allow(''),
});

module.exports = { withdrawSchema, reviewSchema, topUpSchema, bankAccountSchema };
