const Joi = require('joi');
const { PAYMENT_STATUS } = require('../../common/constants');

const paySchema = Joi.object({
  method: Joi.string().valid('manual', 'wallet').default('manual'),
});

const payStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      PAYMENT_STATUS.PAID,
      PAYMENT_STATUS.FAILED,
      PAYMENT_STATUS.REFUNDED,
      PAYMENT_STATUS.PENDING
    )
    .required(),
  adminNote: Joi.string().allow(''),
});

const planSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  price: Joi.number().min(0).required(),
  currency: Joi.string().default('USD'),
  billingCycle: Joi.string().valid('one_time', 'monthly', 'yearly'),
  features: Joi.array().items(Joi.string()),
  isActive: Joi.boolean(),
});

const subscribeSchema = Joi.object({
  planId: Joi.string().hex().length(24).required(),
});

module.exports = { paySchema, payStatusSchema, planSchema, subscribeSchema };
