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

// Conditional update: only applies when the payment is still in one of `fromStatuses`.
async function transitionPayment(id, fromStatuses, data) {
  return Payment.findOneAndUpdate({ _id: id, status: { $in: fromStatuses } }, data, { new: true });
}

// Claim the right to settle exactly once; returns null if already settled.
async function claimSettlement(id, settlement) {
  return Payment.findOneAndUpdate(
    { _id: id, settledAt: { $exists: false } },
    { $set: { settledAt: new Date(), settlement } },
    { new: true }
  );
}

async function listPayments(filter, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('bookingId')
      .populate('planId')
      .populate('payerUserId', 'name phone role')
      .populate('beneficiaryUserId', 'name role refCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

// Void unpaid invoices of a cancelled booking so they can no longer be paid.
async function voidBookingPayments(bookingId) {
  return Payment.updateMany(
    { bookingId, status: { $in: ['pending', 'failed'] } },
    { status: 'cancelled' }
  );
}

// A replacement tutor takes over the class, so unpaid invoices follow them.
async function reassignBookingBeneficiary(bookingId, beneficiaryUserId) {
  return Payment.updateMany(
    { bookingId, status: { $in: ['pending', 'failed', 'awaiting_confirmation'] } },
    { beneficiaryUserId }
  );
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
  transitionPayment,
  claimSettlement,
  voidBookingPayments,
  reassignBookingBeneficiary,
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
