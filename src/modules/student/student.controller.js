const studentService = require('./student.service');
const { success } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const dashboard = asyncHandler(async (req, res) => {
  const data = await studentService.getDashboard(req.user.id);
  return success(res, data);
});

module.exports = { dashboard };
