const express = require('express');
const controller = require('./student.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/dashboard', authenticate, authorize(ROLES.STUDENT), controller.dashboard);

module.exports = router;
