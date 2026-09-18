const { Payment, SubscriptionPlan } = require('./payment.model');

async function createPayment(data) {
  return Payment.create(data);
}

async function findPaymentById(id) {
  return Payment.findById(id)
    .populate('bookingId')
    .populate('planId')
    .populate('payerUserId', 'name phone role');
}

async function updatePayment(id, data) {
  return Payment.findByIdAndUpdate(id, data, { new: true });
}

async function listPayments(filter, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('bookingId')
      .populate('planId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function createPlan(data) {
  return SubscriptionPlan.create(data);
}

async function updatePlan(id, data) {
  return SubscriptionPlan.findByIdAndUpdate(id, data, { new: true });
}

async function listPlans(filter = {}) {
  return SubscriptionPlan.find(filter).sort({ price: 1 });
}

async function findPlanById(id) {
  return SubscriptionPlan.findById(id);
}

async function revenuePaid() {
  const result = await Payment.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: '$currency', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return result;
}

module.exports = {
  createPayment,
  findPaymentById,
  updatePayment,
  listPayments,
  createPlan,
  updatePlan,
  listPlans,
  findPlanById,
  revenuePaid,
};
