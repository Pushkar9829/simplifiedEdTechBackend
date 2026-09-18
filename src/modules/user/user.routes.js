const express = require('express');
const controller = require('./user.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { updateMeSchema, adminStatusSchema, adminListQuerySchema } = require('./user.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/me', authenticate, controller.getMe);
router.patch('/me', authenticate, validate(updateMeSchema), controller.updateMe);

router.get(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(adminListQuerySchema, 'query'),
  controller.adminList
);
router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(adminStatusSchema),
  controller.adminSetStatus
);

module.exports = router;
