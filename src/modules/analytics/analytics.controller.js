const analyticsService = require('./analytics.service');
const { success } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');
const ApiError = require('../../common/ApiError');

const overview = asyncHandler(async (_req, res) => {
  const data = await analyticsService.overview();
  return success(res, data);
});

const tutors = asyncHandler(async (_req, res) => {
  const data = await analyticsService.getTutorPerformance();
  return success(res, data);
});

const tutorDetail = asyncHandler(async (req, res) => {
  const data = await analyticsService.tutorDetail(req.params.tutorId);
  if (!data) throw new ApiError(404, 'Tutor analytics not found');
  return success(res, data);
});

module.exports = { overview, tutors, tutorDetail };
