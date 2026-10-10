const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const countrySchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().min(2).max(3).required(),
  currency: Joi.string().length(3).required(),
  currencySymbol: Joi.string().allow(''),
  defaultTimezone: Joi.string(),
  timezones: Joi.array().items(Joi.string()),
  isActive: Joi.boolean(),
});

const boardSchema = Joi.object({
  name: Joi.string().required(),
  code: Joi.string().allow(''),
  countryId: objectId.allow(null, ''),
  isActive: Joi.boolean(),
});

const classLevelSchema = Joi.object({
  name: Joi.string().required(),
  sortOrder: Joi.number(),
  countryId: objectId.allow(null, ''),
  isActive: Joi.boolean(),
});

const lookupSchema = Joi.object({
  group: Joi.string().required(),
  value: Joi.string().required(),
  label: Joi.string().required(),
  sortOrder: Joi.number(),
  isActive: Joi.boolean(),
  meta: Joi.object().unknown(true),
});

const optionalAll = (schema, keys) => schema.fork(keys, (s) => s.optional());
const countryUpdateSchema = optionalAll(countrySchema, ['name', 'code', 'currency']);
const boardUpdateSchema = optionalAll(boardSchema, ['name']);
const classLevelUpdateSchema = optionalAll(classLevelSchema, ['name']);
const lookupUpdateSchema = optionalAll(lookupSchema, ['group', 'value', 'label']);

module.exports = {
  countrySchema,
  boardSchema,
  classLevelSchema,
  lookupSchema,
  countryUpdateSchema,
  boardUpdateSchema,
  classLevelUpdateSchema,
  lookupUpdateSchema,
};
