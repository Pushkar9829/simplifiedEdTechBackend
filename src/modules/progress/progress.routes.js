const express = require('express');
const controller = require('./progress.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/me', authenticate, authorize(ROLES.STUDENT), controller.me);
router.get(
  '/student/:studentId',
  authenticate,
  authorize(ROLES.PARENT, ROLES.TUTOR, ROLES.ADMIN),
  controller.forStudent
);
router.post('/hours', authenticate, authorize(ROLES.STUDENT), controller.addHours);
router.get('/badges', authenticate, controller.listBadges);
router.post('/badges', authenticate, authorize(ROLES.ADMIN), controller.createBadge);
router.post('/badges/award', authenticate, authorize(ROLES.ADMIN, ROLES.TUTOR), controller.awardBadge);

module.exports = router;
