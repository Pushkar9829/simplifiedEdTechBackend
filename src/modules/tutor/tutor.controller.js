const tutorService = require('./tutor.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');
const { storedFileUrl } = require('../../utils/mediaUrl');

const search = asyncHandler(async (req, res) => {
  const data = await tutorService.search(req.query, req.user.role);
  return success(res, data);
});

const getById = asyncHandler(async (req, res) => {
  const data = await tutorService.getById(req.params.id, req.user.role);
  return success(res, data);
});

const updateMe = asyncHandler(async (req, res) => {
  const data = await tutorService.updateMyProfile(req.user.id, req.body);
  return success(res, data, 'Tutor profile updated');
});

const addOffering = asyncHandler(async (req, res) => {
  const data = await tutorService.addSubjectOffering(req.user.id, req.body);
  return created(res, data, 'Subject offering saved');
});

const myOfferings = asyncHandler(async (req, res) => {
  const data = await tutorService.myOfferings(req.user.id);
  return success(res, data);
});

const addAvailability = asyncHandler(async (req, res) => {
  const data = await tutorService.addAvailability(req.user.id, req.body);
  return created(res, data, 'Availability added');
});

const myAvailability = asyncHandler(async (req, res) => {
  const data = await tutorService.myAvailability(req.user.id);
  return success(res, data);
});

const removeAvailability = asyncHandler(async (req, res) => {
  const data = await tutorService.removeAvailability(req.user.id, req.params.id);
  return success(res, data, 'Availability removed');
});

const submitVerification = asyncHandler(async (req, res) => {
  const data = await tutorService.submitVerification(req.user.id, req.files || {}, req.body.notes);
  return created(res, data, 'Verification submitted');
});

const pendingVerifications = asyncHandler(async (_req, res) => {
  const data = await tutorService.pendingVerifications();
  return success(res, data);
});

const reviewVerification = asyncHandler(async (req, res) => {
  const data = await tutorService.adminReviewVerification(
    req.params.id,
    req.body.status,
    req.body.adminNote
  );
  return success(res, data, 'Verification reviewed');
});

const addReview = asyncHandler(async (req, res) => {
  const data = await tutorService.addReview(req.user.id, req.params.id, req.body);
  return created(res, data, 'Review submitted');
});

const addStudentNote = asyncHandler(async (req, res) => {
  const data = await tutorService.addStudentNote(req.user.id, req.body);
  return created(res, data, 'Note saved');
});

const listStudentNotes = asyncHandler(async (req, res) => {
  const data = await tutorService.listStudentNotes(req.user.id, req.query.studentUserId);
  return success(res, data);
});

const removeStudentNote = asyncHandler(async (req, res) => {
  const data = await tutorService.removeStudentNote(req.user.id, req.params.noteId);
  return success(res, data, 'Note deleted');
});

const addLessonPlan = asyncHandler(async (req, res) => {
  const data = await tutorService.addLessonPlan(req.user.id, req.body);
  return created(res, data, 'Lesson plan created');
});

const updateLessonPlan = asyncHandler(async (req, res) => {
  const data = await tutorService.updateLessonPlan(req.user.id, req.params.planId, req.body);
  return success(res, data, 'Lesson plan updated');
});

const listLessonPlans = asyncHandler(async (req, res) => {
  const data = await tutorService.listLessonPlans(req.user.id, req.query);
  return success(res, data);
});

const removeLessonPlan = asyncHandler(async (req, res) => {
  const data = await tutorService.removeLessonPlan(req.user.id, req.params.planId);
  return success(res, data, 'Lesson plan deleted');
});

const addVideo = asyncHandler(async (req, res) => {
  const fileUrl = storedFileUrl(req.file) || req.body.fileUrl;
  const data = await tutorService.addVideo(req.user.id, { ...req.body, fileUrl });
  return created(res, data, 'Demo video added');
});

const listVideos = asyncHandler(async (req, res) => {
  const data = await tutorService.myVideos(req.user.id);
  return success(res, data);
});

const removeVideo = asyncHandler(async (req, res) => {
  const data = await tutorService.removeVideo(req.user.id, req.params.videoId);
  return success(res, data, 'Video deleted');
});

module.exports = {
  search,
  getById,
  updateMe,
  addOffering,
  myOfferings,
  addAvailability,
  myAvailability,
  removeAvailability,
  submitVerification,
  pendingVerifications,
  reviewVerification,
  addReview,
  addStudentNote,
  listStudentNotes,
  removeStudentNote,
  addLessonPlan,
  updateLessonPlan,
  listLessonPlans,
  removeLessonPlan,
  addVideo,
  listVideos,
  removeVideo,
};
