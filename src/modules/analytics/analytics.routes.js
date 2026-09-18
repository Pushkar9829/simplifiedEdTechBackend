const express = require('express');
const controller = require('./analytics.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/overview', authenticate, authorize(ROLES.ADMIN), controller.overview);
router.get('/tutors', authenticate, authorize(ROLES.ADMIN), controller.tutors);
router.get('/tutors/:tutorId', authenticate, authorize(ROLES.ADMIN), controller.tutorDetail);

module.exports = router;
