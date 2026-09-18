const parentService = require('./parent.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const linkStudent = asyncHandler(async (req, res) => {
  const data = await parentService.linkStudent(
    req.user.id,
    req.body.studentPhone,
    req.body.relationship
  );
  return created(res, data, 'Student linked');
});

const children = asyncHandler(async (req, res) => {
  const data = await parentService.myChildren(req.user.id);
  return success(res, data);
});

const dashboard = asyncHandler(async (req, res) => {
  const data = await parentService.dashboard(req.user.id, req.params.studentId);
  return success(res, data);
});

module.exports = { linkStudent, children, dashboard };
