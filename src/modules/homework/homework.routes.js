const express = require('express');
const controller = require('./homework.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { createAssignmentSchema, gradeSchema } = require('./homework.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/', authenticate, authorize(ROLES.STUDENT, ROLES.TUTOR, ROLES.PARENT), controller.list);
router.get('/stats/me', authenticate, authorize(ROLES.TUTOR), controller.stats);
router.get('/:id', authenticate, authorize(ROLES.STUDENT, ROLES.TUTOR, ROLES.PARENT), controller.getById);
router.post(
  '/',
  authenticate,
  authorize(ROLES.TUTOR),
  upload.array('attachments', 10),
  validate(createAssignmentSchema),
  controller.create
);
router.post(
  '/:id/submit',
  authenticate,
  authorize(ROLES.STUDENT),
  upload.array('files', 10),
  controller.submit
);
router.post(
  '/:id/grade',
  authenticate,
  authorize(ROLES.TUTOR),
  validate(gradeSchema),
  controller.grade
);

module.exports = router;
