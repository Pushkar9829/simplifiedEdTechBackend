const express = require('express');
const controller = require('./tutor.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const {
  offeringSchema,
  availabilitySchema,
  reviewVerificationSchema,
  studentReviewSchema,
  studentNoteSchema,
  lessonPlanSchema,
  videoSchema,
} = require('./tutor.validator');
const { ROLES } = require('../../common/constants');

const router = express.Router();

router.get('/', authenticate, controller.search);
router.get('/me/offerings', authenticate, authorize(ROLES.TUTOR), controller.myOfferings);
router.post(
  '/me/offerings',
  authenticate,
  authorize(ROLES.TUTOR),
  validate(offeringSchema),
  controller.addOffering
);
router.get('/me/availability', authenticate, authorize(ROLES.TUTOR), controller.myAvailability);
router.post(
  '/me/availability',
  authenticate,
  authorize(ROLES.TUTOR),
  validate(availabilitySchema),
  controller.addAvailability
);
router.delete(
  '/me/availability/:id',
  authenticate,
  authorize(ROLES.TUTOR),
  controller.removeAvailability
);
router.patch('/me', authenticate, authorize(ROLES.TUTOR), controller.updateMe);
router.post(
  '/me/verification',
  authenticate,
  authorize(ROLES.TUTOR),
  upload.fields([
    { name: 'identityDoc', maxCount: 1 },
    { name: 'degreeDoc', maxCount: 1 },
    { name: 'certificateDoc', maxCount: 1 },
    { name: 'resumeDoc', maxCount: 1 },
  ]),
  controller.submitVerification
);

router.get('/me/notes', authenticate, authorize(ROLES.TUTOR), controller.listStudentNotes);
router.post(
  '/me/notes',
  authenticate,
  authorize(ROLES.TUTOR),
  validate(studentNoteSchema),
  controller.addStudentNote
);
router.delete(
  '/me/notes/:noteId',
  authenticate,
  authorize(ROLES.TUTOR),
  controller.removeStudentNote
);

router.get('/me/lesson-plans', authenticate, authorize(ROLES.TUTOR), controller.listLessonPlans);
router.post(
  '/me/lesson-plans',
  authenticate,
  authorize(ROLES.TUTOR),
  validate(lessonPlanSchema),
  controller.addLessonPlan
);
router.patch(
  '/me/lesson-plans/:planId',
  authenticate,
  authorize(ROLES.TUTOR),
  controller.updateLessonPlan
);
router.delete(
  '/me/lesson-plans/:planId',
  authenticate,
  authorize(ROLES.TUTOR),
  controller.removeLessonPlan
);

router.get('/me/videos', authenticate, authorize(ROLES.TUTOR), controller.listVideos);
router.post(
  '/me/videos',
  authenticate,
  authorize(ROLES.TUTOR),
  upload.single('file'),
  validate(videoSchema),
  controller.addVideo
);
router.delete('/me/videos/:videoId', authenticate, authorize(ROLES.TUTOR), controller.removeVideo);

router.get(
  '/verifications/pending',
  authenticate,
  authorize(ROLES.ADMIN),
  controller.pendingVerifications
);
router.patch(
  '/:id/verification',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(reviewVerificationSchema),
  controller.reviewVerification
);
router.post(
  '/:id/reviews',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(studentReviewSchema),
  controller.addReview
);

router.get('/:id', authenticate, controller.getById);

module.exports = router;
