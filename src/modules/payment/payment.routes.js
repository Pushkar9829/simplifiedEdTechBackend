const express = require('express');
const controller = require('./payment.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { paySchema, payStatusSchema, planSchema, subscribeSchema } = require('./payment.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/plans', authenticate, controller.listPlans);
router.get('/payable', authenticate, authorize(ROLES.STUDENT, ROLES.PARENT, ROLES.TUTOR), controller.payable);
router.get('/history', authenticate, controller.history);
router.get('/earnings', authenticate, authorize(ROLES.TUTOR), controller.earnings);
router.get('/earnings/summary', authenticate, authorize(ROLES.TUTOR), controller.earningsSummary);
router.post(
  '/:id/pay',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT, ROLES.TUTOR),
  validate(paySchema),
  controller.pay
);
router.post(
  '/:id/refund',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT),
  controller.requestRefund
);
router.post(
  '/:id/refund/respond',
  authenticate,
  authorize(ROLES.TUTOR, ROLES.ADMIN),
  controller.respondRefund
);
router.post(
  '/subscribe',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT, ROLES.TUTOR),
  validate(subscribeSchema),
  controller.subscribe
);

router.get('/admin/all', authenticate, authorize(ROLES.ADMIN), controller.adminList);
router.get('/admin/:id', authenticate, authorize(ROLES.ADMIN), controller.adminGet);
router.patch(
  '/admin/:id/status',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(payStatusSchema),
  controller.adminSetStatus
);
router.post(
  '/admin/plans',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(planSchema),
  controller.createPlan
);
router.patch(
  '/admin/plans/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(planSchema.fork(['name', 'price'], (s) => s.optional())),
  controller.updatePlan
);

module.exports = router;
