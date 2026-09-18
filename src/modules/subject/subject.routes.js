const express = require('express');
const controller = require('./subject.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const {
  createSubjectSchema,
  updateSubjectSchema,
  selectSubjectsSchema,
} = require('./subject.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/', controller.list);
router.post('/', authenticate, authorize(ROLES.ADMIN), validate(createSubjectSchema), controller.create);
router.patch('/:id', authenticate, authorize(ROLES.ADMIN), validate(updateSubjectSchema), controller.update);
router.post(
  '/select',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(selectSubjectsSchema),
  controller.select
);

module.exports = router;
