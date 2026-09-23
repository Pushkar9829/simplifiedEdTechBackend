const courseService = require('./course.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');
const { storedFileUrl } = require('../../utils/mediaUrl');

const list = asyncHandler(async (req, res) => {
  const data =
    req.user.role === 'tutor' && req.query.mine === 'true'
      ? await courseService.listMine(req.user.id)
      : await courseService.listPublished(req.query);
  return success(res, data);
});

const mine = asyncHandler(async (req, res) => {
  const data = await courseService.listMine(req.user.id);
  return success(res, data);
});

const enrollments = asyncHandler(async (req, res) => {
  const data = await courseService.myEnrollments(req.user.id);
  return success(res, data);
});

const getById = asyncHandler(async (req, res) => {
  const data = await courseService.getById(req.params.id, req.user);
  return success(res, data);
});

const create = asyncHandler(async (req, res) => {
  const data = await courseService.create(req.user.id, req.body, storedFileUrl(req.file));
  return created(res, data, 'Course created');
});

const update = asyncHandler(async (req, res) => {
  const data = await courseService.update(req.user.id, req.params.id, req.body, storedFileUrl(req.file));
  return success(res, data, 'Course updated');
});

const publish = asyncHandler(async (req, res) => {
  const data = await courseService.publish(req.user.id, req.params.id);
  return success(res, data, 'Course published');
});

const remove = asyncHandler(async (req, res) => {
  const data = await courseService.remove(req.user.id, req.params.id);
  return success(res, data, 'Course deleted');
});

const enroll = asyncHandler(async (req, res) => {
  const data = await courseService.enroll(req.user, req.params.id, req.body.studentUserId);
  return created(res, data, 'Enrollment created. Pay to start the course.');
});

module.exports = {
  list,
  mine,
  enrollments,
  getById,
  create,
  update,
  publish,
  remove,
  enroll,
};
