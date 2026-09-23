const express = require('express');
const controller = require('./message.controller');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { openSchema, sendSchema } = require('./message.validator');

const router = express.Router();

router.get('/', authenticate, controller.listConversations);
router.get('/contacts', authenticate, controller.contacts);
router.post('/open', authenticate, validate(openSchema), controller.open);
router.post('/', authenticate, upload.array('attachments', 5), validate(sendSchema), controller.send);
router.get('/:id', authenticate, controller.listMessages);
router.patch('/:id/read', authenticate, controller.markRead);

module.exports = router;
