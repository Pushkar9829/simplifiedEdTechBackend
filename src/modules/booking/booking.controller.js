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

const complete = asyncHandler(async (req, res) => {
  const data = await bookingService.completeBooking(req.user.id, req.params.id);
  return success(res, data, 'Booking completed');
});

const join = asyncHandler(async (req, res) => {
  const data = await bookingService.joinBooking(req.user, req.params.id);
  return success(res, data);
});

module.exports = { create, list, cancel, reschedule, attendance, complete, join };
