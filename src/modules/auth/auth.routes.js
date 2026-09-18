const express = require('express');
const controller = require('./auth.controller');
const { validate } = require('../../middleware/validate');
const { sendOtpSchema, verifyOtpSchema, googleSchema } = require('./auth.validator');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

router.post('/send-otp', validate(sendOtpSchema), controller.sendOtp);
router.post('/verify-otp', validate(verifyOtpSchema), controller.verifyOtp);
router.post('/google', validate(googleSchema), controller.google);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);

module.exports = router;
