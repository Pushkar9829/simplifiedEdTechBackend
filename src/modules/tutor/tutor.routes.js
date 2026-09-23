const express = require('express');
const controller = require('./tutor.controller');
const bookingController = require('../booking/booking.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const {
  offeringSchema,
  availabilitySchema,
  reviewVerificationSchema,
  referencesSchema,
  referenceOtpSchema,
  studentReviewSchema,
  studentNoteSchema,
  lessonPlanSchema,
  videoSchema,
} = require('./tutor.validator');
const {
  ROLES,
  VERIFICATION_DOC_FIELDS,
  VERIFICATION_MAX_FILES_PER_FIELD,
} = require('../../common/constants');

const router = express.Router();
const tutorOnly = [authenticate, authorize(ROLES.TUTOR)];

router.get('/', authenticate, controller.search);
router.get('/me/offerings', ...tutorOnly, controller.myOfferings);
router.post('/me/offerings', ...tutorOnly, validate(offeringSchema), controller.addOffering);
router.delete('/me/offerings/:id', ...tutorOnly, controller.removeOffering);
router.get('/me/availability', ...tutorOnly, controller.myAvailability);
router.post('/me/availability', ...tutorOnly, validate(availabilitySchema), controller.addAvailability);
router.delete('/me/availability/:id', ...tutorOnly, controller.removeAvailability);
router.patch('/me', ...tutorOnly, controller.updateMe);

router.get('/me/verification', ...tutorOnly, controller.myVerification);
router.put(
  '/me/verification/references',
  ...tutorOnly,
  validate(referencesSchema),
  controller.saveReferences
);
router.post('/me/verification/references/:idx/send-otp', ...tutorOnly, controller.sendReferenceOtp);
router.post(
  '/me/verification/references/:idx/verify-otp',
  ...tutorOnly,
  validate(referenceOtpSchema),
  controller.verifyReferenceOtp
);
router.post(
  '/me/verification',
  ...tutorOnly,
  upload.fields(
    VERIFICATION_DOC_FIELDS.flatMap((name) => [
      { name, maxCount: VERIFICATION_MAX_FILES_PER_FIELD },
      { name: `${name}Doc`, maxCount: 1 },
    ])
  ),
  controller.submitVerification
);
router.delete(
  '/me/verification/documents/:field/:docId',
  ...tutorOnly,
  controller.removeVerificationDocument
);

router.get('/me/students/:id/last-report', ...tutorOnly, bookingController.studentInsights);

router.get('/me/notes', ...tutorOnly, controller.listStudentNotes);
router.post('/me/notes', ...tutorOnly, validate(studentNoteSchema), controller.addStudentNote);
router.delete('/me/notes/:noteId', ...tutorOnly, controller.removeStudentNote);

router.get('/me/lesson-plans', ...tutorOnly, controller.listLessonPlans);
router.get('/me/lesson-plans/:planId', ...tutorOnly, controller.getLessonPlan);
router.post('/me/lesson-plans', ...tutorOnly, validate(lessonPlanSchema), controller.addLessonPlan);
router.patch('/me/lesson-plans/:planId', ...tutorOnly, controller.updateLessonPlan);
router.delete('/me/lesson-plans/:planId', ...tutorOnly, controller.removeLessonPlan);

router.get('/me/videos', ...tutorOnly, controller.listVideos);
router.post('/me/videos', ...tutorOnly, upload.single('file'), validate(videoSchema), controller.addVideo);
router.delete('/me/videos/:videoId', ...tutorOnly, controller.removeVideo);

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
