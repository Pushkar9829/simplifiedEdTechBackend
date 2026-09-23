const express = require('express');
const controller = require('./project.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { createSchema, statusSchema, updateSchema } = require('./project.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/', authenticate, controller.list);
router.get('/:id', authenticate, controller.getById);
router.post(
  '/',
  authenticate,
  authorize(ROLES.TUTOR),
  upload.array('attachments', 10),
  validate(createSchema),
  controller.create
);
router.patch('/:id', authenticate, authorize(ROLES.TUTOR), validate(updateSchema), controller.update);
router.patch('/:id/status', authenticate, validate(statusSchema), controller.setStatus);
router.post(
  '/:id/deliver',
  authenticate,
  authorize(ROLES.TUTOR),
  upload.array('deliverables', 10),
  controller.deliver
);

module.exports = router;
