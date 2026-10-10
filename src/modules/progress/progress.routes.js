const express = require('express');
const controller = require('./progress.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { addHoursSchema, awardBadgeSchema } = require('./progress.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/me', authenticate, authorize(ROLES.STUDENT), controller.me);
router.get(
  '/student/:studentId',
  authenticate,
  authorize(ROLES.PARENT, ROLES.TUTOR, ROLES.ADMIN),
  controller.forStudent
);
router.post(
  '/hours',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(addHoursSchema),
  controller.addHours
);
router.get('/badges', authenticate, controller.listBadges);
router.post('/badges', authenticate, authorize(ROLES.ADMIN), controller.createBadge);
router.post(
  '/badges/award',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.TUTOR),
  validate(awardBadgeSchema),
  controller.awardBadge
);

module.exports = router;
