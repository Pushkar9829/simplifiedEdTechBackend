const Joi = require('joi');

const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const updateTicketSchema = Joi.object({
  status: Joi.string().valid(...TICKET_STATUSES),
  adminNote: Joi.string().allow('').max(5000),
});

module.exports = { TICKET_STATUSES, updateTicketSchema };
