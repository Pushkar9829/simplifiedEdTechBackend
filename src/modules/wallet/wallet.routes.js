const express = require('express');
const controller = require('./wallet.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { withdrawSchema, reviewSchema, topUpSchema } = require('./wallet.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/me', authenticate, controller.me);
router.post(
  '/withdraw',
  authenticate,
  authorize(ROLES.TUTOR),
  validate(withdrawSchema),
  controller.withdraw
);
router.get('/withdrawals', authenticate, authorize(ROLES.TUTOR), controller.myWithdrawals);

router.get('/platform', authenticate, authorize(ROLES.ADMIN), controller.platform);
router.get('/admin/withdrawals', authenticate, authorize(ROLES.ADMIN), controller.adminWithdrawals);
router.patch(
  '/admin/withdrawals/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(reviewSchema),
  controller.reviewWithdrawal
);
router.post(
  '/admin/top-up',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(topUpSchema),
  controller.topUp
);

module.exports = router;
