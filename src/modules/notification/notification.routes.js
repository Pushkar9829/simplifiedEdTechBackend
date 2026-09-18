const express = require('express');
const controller = require('./notification.controller');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

router.get('/', authenticate, controller.list);
router.patch('/:id/read', authenticate, controller.markRead);
router.patch('/read-all', authenticate, controller.markAllRead);

module.exports = router;
