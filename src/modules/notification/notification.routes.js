const express = require('express');
const controller = require('./notification.controller');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

router.get('/', authenticate, controller.list);
router.get('/unread-count', authenticate, controller.unreadCount);
router.patch('/read-all', authenticate, controller.markAllRead);
router.patch('/:id/read', authenticate, controller.markRead);

module.exports = router;
