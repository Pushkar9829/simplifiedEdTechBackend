const express = require('express');
const controller = require('./resource.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { createResourceSchema } = require('./resource.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/', authenticate, controller.list);
router.get('/bookmarks/me', authenticate, authorize(ROLES.STUDENT), controller.myBookmarks);
router.get('/:id', authenticate, controller.getById);
router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.TUTOR),
  upload.single('file'),
  validate(createResourceSchema),
  controller.create
);
router.patch('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.TUTOR), controller.update);
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), controller.remove);
router.post('/:id/bookmark', authenticate, authorize(ROLES.STUDENT), controller.bookmark);
router.delete('/:id/bookmark', authenticate, authorize(ROLES.STUDENT), controller.unbookmark);

module.exports = router;
