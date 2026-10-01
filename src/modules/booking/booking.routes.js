const express = require('express');
const controller = require('./booking.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const {
  createBookingSchema,
  rescheduleSchema,
  attendanceSchema,
  meetingStatusSchema,
  reportSchema,
  completeSchema,
} = require('./booking.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();
const tutorOnly = [authenticate, authorize(ROLES.TUTOR)];

router.get('/', authenticate, controller.list);
router.post(
  '/',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT),
  validate(createBookingSchema),
  controller.create
);
router.get('/students/:studentId/insights', ...tutorOnly, controller.studentInsights);
router.get('/schedule-changes', authenticate, controller.listScheduleChanges);
router.get('/reschedule-entitlement', authenticate, controller.entitlement);
router.post('/:id/reschedule/request', authenticate, controller.requestReschedule);
router.post('/:id/reschedule/offer', authenticate, controller.offerRescheduleSlots);
router.post('/:id/reschedule/select', authenticate, controller.selectRescheduleSlot);
router.post('/:id/reschedule/replacement', authenticate, controller.proposeReplacement);
router.post('/:id/reschedule/approve', authenticate, controller.approveReplacement);
router.post('/:id/reschedule/decline', authenticate, controller.declineReschedule);
router.post(
  '/:id/cancel',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT, ROLES.TUTOR, ROLES.ADMIN),
  controller.cancel
);
router.post(
  '/:id/reschedule',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT, ROLES.TUTOR, ROLES.ADMIN),
  validate(rescheduleSchema),
  controller.reschedule
);
router.patch('/:id/attendance', ...tutorOnly, validate(attendanceSchema), controller.attendance);
router.patch('/:id/meeting-status', ...tutorOnly, validate(meetingStatusSchema), controller.meetingStatus);
router.post(
  '/:id/complete',
  ...tutorOnly,
  upload.array('attachments', 10),
  validate(completeSchema),
  controller.complete
);
router.put('/:id/report', ...tutorOnly, validate(reportSchema), controller.saveReport);
router.get('/:id/join', authenticate, controller.join);
router.post(
  '/:id/feedback',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT),
  controller.feedback
);
router.get('/:id/summary', authenticate, controller.summary);
router.get('/:id/chain', authenticate, controller.chain);

module.exports = router;
