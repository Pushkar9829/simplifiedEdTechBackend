const express = require('express');
const controller = require('./course.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { courseSchema, coursePatchSchema, enrollSchema } = require('./course.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/', authenticate, controller.list);
router.get('/mine', authenticate, authorize(ROLES.TUTOR), controller.mine);
router.get('/enrollments/me', authenticate, authorize(ROLES.STUDENT, ROLES.PARENT), controller.enrollments);
router.get('/:id', authenticate, controller.getById);
router.post(
  '/',
  authenticate,
  authorize(ROLES.TUTOR),
  upload.single('thumbnail'),
  validate(courseSchema),
  controller.create
);
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.TUTOR),
  upload.single('thumbnail'),
  validate(coursePatchSchema),
  controller.update
);
router.post('/:id/publish', authenticate, authorize(ROLES.TUTOR), controller.publish);
router.delete('/:id', authenticate, authorize(ROLES.TUTOR), controller.remove);
router.post(
  '/:id/enroll',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT),
  validate(enrollSchema),
  controller.enroll
);

module.exports = router;
