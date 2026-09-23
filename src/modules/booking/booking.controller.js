const bookingService = require('./booking.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const create = asyncHandler(async (req, res) => {
  const data = await bookingService.createBooking(req.user, req.body);
  return created(res, data, 'Booking created');
});

const list = asyncHandler(async (req, res) => {
  const data = await bookingService.listBookings(req.user, req.query);
  return success(res, data);
});

const cancel = asyncHandler(async (req, res) => {
  const data = await bookingService.cancelBooking(req.user, req.params.id);
  return success(res, data, 'Booking cancelled');
});

const reschedule = asyncHandler(async (req, res) => {
  const data = await bookingService.rescheduleBooking(req.user, req.params.id, req.body);
  return success(res, data, 'Booking rescheduled');
});

const attendance = asyncHandler(async (req, res) => {
  const data = await bookingService.setAttendance(req.user.id, req.params.id, req.body.attendance);
  return success(res, data, 'Attendance updated');
});

const meetingStatus = asyncHandler(async (req, res) => {
  const data = await bookingService.setMeetingStatus(req.user.id, req.params.id, req.body.meetingStatus);
  return success(res, data, 'Meeting status updated');
});

const complete = asyncHandler(async (req, res) => {
  const data = await bookingService.completeBooking(
    req.user.id,
    req.params.id,
    req.body,
    req.files || []
  );
  return success(res, data, 'Booking completed');
});

const saveReport = asyncHandler(async (req, res) => {
  const data = await bookingService.saveReport(req.user.id, req.params.id, req.body);
  return success(res, data, 'Session report saved');
});

const join = asyncHandler(async (req, res) => {
  const data = await bookingService.joinBooking(req.user, req.params.id);
  return success(res, data);
});

const summary = asyncHandler(async (req, res) => {
  const data = await bookingService.bookingSummary(req.user, req.params.id);
  return success(res, data);
});

const chain = asyncHandler(async (req, res) => {
  const data = await bookingService.bookingChain(req.user, req.params.id);
  return success(res, data);
});

const studentInsights = asyncHandler(async (req, res) => {
  const data = await bookingService.studentInsights(req.user.id, req.params.studentId || req.params.id);
  return success(res, data);
});

module.exports = {
  create,
  list,
  cancel,
  reschedule,
  attendance,
  meetingStatus,
  complete,
  saveReport,
  join,
  summary,
  chain,
  studentInsights,
};
