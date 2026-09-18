const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../common/constants');
const userController = require('../user/user.controller');
const tutorController = require('../tutor/tutor.controller');
const paymentController = require('../payment/payment.controller');
const { validate } = require('../../middleware/validate');
const { adminStatusSchema, adminListQuerySchema } = require('../user/user.validator');
const { reviewVerificationSchema } = require('../tutor/tutor.validator');
const { payStatusSchema, planSchema } = require('../payment/payment.validator');

const router = express.Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/users', validate(adminListQuerySchema, 'query'), userController.adminList);
router.patch('/users/:id/status', validate(adminStatusSchema), userController.adminSetStatus);

router.get('/tutors/verifications/pending', tutorController.pendingVerifications);
router.patch(
  '/tutors/:id/verification',
  validate(reviewVerificationSchema),
  tutorController.reviewVerification
);

router.get('/payments', paymentController.adminList);
router.patch('/payments/:id/status', validate(payStatusSchema), paymentController.adminSetStatus);
router.post('/subscription-plans', validate(planSchema), paymentController.createPlan);
router.patch(
  '/subscription-plans/:id',
  validate(planSchema.fork(['name', 'price'], (s) => s.optional())),
  paymentController.updatePlan
);

module.exports = router;
