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

const scheduleChangeService = require('./scheduleChange.service');

const cancel = asyncHandler(async (req, res) => {
  const data = await scheduleChangeService.policyCancel(req.user, req.params.id, req.body || {});
  return success(res, data, data.policy?.consumed ? 'Class marked consumed' : 'Booking cancelled');
});

const entitlement = asyncHandler(async (req, res) => {
  const data = await scheduleChangeService.entitlement(req.user, req.query.studentUserId);
  return success(res, data);
});

const requestReschedule = asyncHandler(async (req, res) => {
  const data = await scheduleChangeService.requestReschedule(req.user, req.params.id, req.body || {});
  return success(res, data, 'Reschedule request opened');
});

const offerRescheduleSlots = asyncHandler(async (req, res) => {
  const data = await scheduleChangeService.offerSlots(req.user, req.params.id, req.body.slotIds || []);
  return success(res, data, data.change?.status === 'awaiting_replacement' ? 'No slot offered' : 'Slots offered');
});

const selectRescheduleSlot = asyncHandler(async (req, res) => {
  const data = await scheduleChangeService.selectSlot(req.user, req.params.id, req.body.slotId);
  return success(res, data, 'Class rescheduled');
});

const proposeReplacement = asyncHandler(async (req, res) => {
  const data = await scheduleChangeService.proposeReplacement(
    req.user,
    req.params.id,
    req.body.tutorUserId
  );
  return success(res, data, 'Replacement tutor proposed');
});

const approveReplacement = asyncHandler(async (req, res) => {
  const data = await scheduleChangeService.approveReplacement(req.user, req.params.id);
  return success(res, data, 'Replacement confirmed');
});

const declineReschedule = asyncHandler(async (req, res) => {
  const data = await scheduleChangeService.declineChange(req.user, req.params.id);
  return success(res, data, data.message);
});

const listScheduleChanges = asyncHandler(async (req, res) => {
  const data = await scheduleChangeService.listMine(req.user);
  return success(res, data);
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

const feedback = asyncHandler(async (req, res) => {
  const data = await bookingService.sendFeedback(req.user, req.params.id, req.body || {});
  return success(res, data, 'Feedback sent to your tutor');
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
  feedback,
  summary,
  chain,
  studentInsights,
  entitlement,
  requestReschedule,
  offerRescheduleSlots,
  selectRescheduleSlot,
  proposeReplacement,
  approveReplacement,
  declineReschedule,
  listScheduleChanges,
};
