const Joi = require('joi');

const openSchema = Joi.object({
  participantId: Joi.string().hex().length(24).required(),
});

const sendSchema = Joi.object({
  conversationId: Joi.string().hex().length(24),
  participantId: Joi.string().hex().length(24),
  body: Joi.string().min(1).required(),
}).or('conversationId', 'participantId');

module.exports = { openSchema, sendSchema };
