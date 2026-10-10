const Joi = require('joi');

const KINDS = ['tutor', 'course', 'project', 'resource'];

const addFavoriteSchema = Joi.object({
  kind: Joi.string().valid(...KINDS).required(),
  targetId: Joi.string().hex().length(24).required(),
});

module.exports = { KINDS, addFavoriteSchema };
