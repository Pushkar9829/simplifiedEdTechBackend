const express = require('express');
const controller = require('./parent.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { linkSchema } = require('./parent.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.post(
  '/link-student',
  authenticate,
  authorize(ROLES.PARENT),
  validate(linkSchema),
  controller.linkStudent
);
router.get('/children', authenticate, authorize(ROLES.PARENT), controller.children);
router.get(
  '/dashboard/:studentId',
  authenticate,
  authorize(ROLES.PARENT),
  controller.dashboard
);

module.exports = router;
