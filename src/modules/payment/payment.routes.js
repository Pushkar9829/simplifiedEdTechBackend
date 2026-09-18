const express = require('express');
const controller = require('./payment.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { paySchema, payStatusSchema, planSchema, subscribeSchema } = require('./payment.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/plans', authenticate, controller.listPlans);
router.get('/payable', authenticate, authorize(ROLES.STUDENT, ROLES.PARENT), controller.payable);
router.get('/history', authenticate, controller.history);
router.get('/earnings', authenticate, authorize(ROLES.TUTOR), controller.earnings);
router.post(
  '/:id/pay',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT),
  validate(paySchema),
  controller.pay
);
router.post(
  '/subscribe',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT),
  validate(subscribeSchema),
  controller.subscribe
);

router.get('/admin/all', authenticate, authorize(ROLES.ADMIN), controller.adminList);
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
