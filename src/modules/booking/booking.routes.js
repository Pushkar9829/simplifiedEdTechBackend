const express = require('express');
const controller = require('./booking.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const {
  createBookingSchema,
  rescheduleSchema,
  attendanceSchema,
} = require('./booking.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/', authenticate, controller.list);
router.post(
  '/',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT),
  validate(createBookingSchema),
  controller.create
);
router.post(
  '/:id/cancel',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT, ROLES.TUTOR, ROLES.ADMIN),
  controller.cancel
);
router.post(
  '/:id/reschedule',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT, ROLES.ADMIN),
  validate(rescheduleSchema),
  controller.reschedule
);
router.patch(
  '/:id/attendance',
  authenticate,
  authorize(ROLES.TUTOR),
  validate(attendanceSchema),
  controller.attendance
);
router.post('/:id/complete', authenticate, authorize(ROLES.TUTOR), controller.complete);
router.get('/:id/join', authenticate, controller.join);

module.exports = router;
