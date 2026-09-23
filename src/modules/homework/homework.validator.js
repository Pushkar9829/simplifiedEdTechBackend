const Joi = require('joi');
const { LEVELS, GRADING_SCHEMES } = require('../../common/constants');

const objectId = Joi.string().hex().length(24);

// Multipart bodies send arrays as repeated fields or a single string.
const idList = Joi.alternatives().try(
  Joi.array().items(objectId),
  objectId.custom((v) => [v])
);

const createAssignmentSchema = Joi.object({
  studentUserId: objectId.required(),
  subjectId: objectId,
  bookingId: objectId.allow(''),
  level: Joi.string().valid(...LEVELS),
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  deadline: Joi.date().iso().required(),
  resourceIds: idList,
  rubric: Joi.string().allow(''),
  gradingScheme: Joi.string().valid(...GRADING_SCHEMES),
  maxScore: Joi.number().positive(),
}).or('subjectId', 'bookingId');

const gradeSchema = Joi.object({
  grade: Joi.alternatives()
    .try(
      Joi.string(),
      Joi.number(),
      Joi.object({
        scheme: Joi.string().valid(...GRADING_SCHEMES),
        value: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        maxScore: Joi.number().positive(),
      })
    )
    .required(),
  feedback: Joi.string().allow(''),
});

module.exports = { createAssignmentSchema, gradeSchema };
