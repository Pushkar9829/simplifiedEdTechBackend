const Joi = require('joi');
const { RESOURCE_ACCESS } = require('../../common/constants');

const createResourceSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  subjectId: Joi.string().hex().length(24).required(),
  level: Joi.string(),
  topic: Joi.string().allow(''),
  chapter: Joi.string().allow(''),
  academicYear: Joi.string().allow(''),
  type: Joi.string().required(),
  fileUrl: Joi.string().allow(''),
  isActive: Joi.boolean(),
  accessType: Joi.string().valid(...Object.values(RESOURCE_ACCESS)),
  price: Joi.number().min(0),
  currency: Joi.string().length(3).uppercase(),
  isDownloadable: Joi.boolean(),
  downloadableUntil: Joi.date().iso().allow('', null),
});

module.exports = { createResourceSchema };
