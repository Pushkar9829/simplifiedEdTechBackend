const paymentService = require('./payment.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const payable = asyncHandler(async (req, res) => {
  const data = await paymentService.listPayable(req.user);
  return success(res, data);
});

const history = asyncHandler(async (req, res) => {
  const data = await paymentService.history(req.user, req.query);
  return success(res, data);
});

const earnings = asyncHandler(async (req, res) => {
  const data = await paymentService.tutorEarnings(req.user.id, req.query);
  return success(res, data);
});

const earningsSummary = asyncHandler(async (req, res) => {
  const data = await paymentService.earningsSummary(req.user.id);
  return success(res, data);
});

const pay = asyncHandler(async (req, res) => {
  const method = req.body?.method || 'manual';
  const data = await paymentService.pay(req.user, req.params.id, method);
  const message =
    method === 'wallet'
      ? 'Paid from wallet'
      : 'Payment submitted for admin confirmation';
  return success(res, data, message);
});

const subscribe = asyncHandler(async (req, res) => {
  const data = await paymentService.subscribePlan(req.user.id, req.body.planId);
  return created(res, data, 'Subscription invoice created. Use Pay to continue.');
});

const listPlans = asyncHandler(async (_req, res) => {
  const data = await paymentService.listPlans(true);
  return success(res, data);
});

const adminList = asyncHandler(async (req, res) => {
  const data = await paymentService.adminList(req.query);
  return success(res, data);
});

const adminSetStatus = asyncHandler(async (req, res) => {
  const data = await paymentService.adminSetStatus(
    req.params.id,
    req.body.status,
    req.body.adminNote
  );
  return success(res, data, 'Payment status updated');
});

const createPlan = asyncHandler(async (req, res) => {
  const data = await paymentService.createPlan(req.body);
  return created(res, data, 'Plan created');
});

const updatePlan = asyncHandler(async (req, res) => {
  const data = await paymentService.updatePlan(req.params.id, req.body);
  return success(res, data, 'Plan updated');
});

module.exports = {
  payable,
  history,
  earnings,
  earningsSummary,
  pay,
  subscribe,
  listPlans,
  adminList,
  adminSetStatus,
  createPlan,
  updatePlan,
};
