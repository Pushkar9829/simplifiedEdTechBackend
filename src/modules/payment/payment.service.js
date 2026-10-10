const mongoose = require('mongoose');
const paymentRepo = require('./payment.repo');
const parentRepo = require('../parent/parent.repo');
const notificationService = require('../notification/notification.service');
const { notifyParentsOfStudent } = require('../../utils/parentNotify');
const walletService = require('../wallet/wallet.service');
const userRepo = require('../user/user.repo');
const ApiError = require('../../common/ApiError');
const User = require('../user/user.model');
const { escapeRegex } = require('../../utils/regex');
const { PAYMENT_STATUS, ROLES, TUTOR_PAYOUT_RATE } = require('../../common/constants');

function money(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function idOf(ref) {
  return (ref?._id || ref)?.toString();
}

// Allowed admin transitions. Refund only from paid; refunded/cancelled are terminal.
const ADMIN_TRANSITIONS = {
  [PAYMENT_STATUS.PENDING]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.AWAITING_CONFIRMATION]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.PENDING],
  [PAYMENT_STATUS.FAILED]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PENDING],
  [PAYMENT_STATUS.PAID]: [PAYMENT_STATUS.REFUNDED],
  [PAYMENT_STATUS.REFUNDED]: [],
  [PAYMENT_STATUS.CANCELLED]: [],
};

// Credit wallets for a paid invoice exactly once (tutor 75% / platform 25%, or platform 100%).
async function settleOnce(payment) {
  const tutorUserId = idOf(payment.beneficiaryUserId);
  const plan = tutorUserId
    ? { tutorUserId, ...walletService.splitAmount(payment.amount) }
    : { tutorAmt: 0, platformAmt: money(payment.amount) };
  const claimed = await paymentRepo.claimSettlement(payment._id, plan);
  if (!claimed) return false;
  if (tutorUserId) await walletService.settlePaidBooking({ payment: claimed, tutorUserId });
  else await walletService.settlePlatformOnly(claimed);
  await fulfillPaidPayment(claimed);
  return true;
}

async function assertBookingPayable(payment) {
  const booking = payment.bookingId;
  if (booking && booking.status === 'cancelled') {
    throw new ApiError(400, 'This class was cancelled; its invoice cannot be paid');
  }
}

function tutorShare(amount) {
  return money(amount * TUTOR_PAYOUT_RATE);
}

async function getPayablePayerIds(user) {
  if (user.role === ROLES.PARENT) {
    const linked = await parentRepo.listLinkedStudentIds(user.id);
    return [user.id, ...linked.map((id) => id.toString())];
  }
  return [user.id];
}

async function assertCanPay(user, payment) {
  const payerId = idOf(payment.payerUserId);
  if (!payerId) throw new ApiError(404, 'Payer not found');

  if (payerId === user.id) return true;

  if (user.role === ROLES.PARENT) {
    const link = await parentRepo.findLink(user.id, payerId);
    if (link) return true;
  }

  throw new ApiError(403, 'Not allowed to pay this invoice');
}

async function listPayable(user, query = {}) {
  const payerIds = await getPayablePayerIds(user);
  return paymentRepo.listPayments(
    {
      payerUserId: { $in: payerIds },
      status: {
        $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.AWAITING_CONFIRMATION],
      },
    },
    {
      page: Math.max(1, Number(query.page) || 1),
      limit: Math.min(Math.max(1, Number(query.limit) || 20), 200),
    }
  );
}

async function history(user, query) {
  const payerIds = await getPayablePayerIds(user);
  const filter =
    user.role === ROLES.TUTOR
      ? { $or: [{ payerUserId: { $in: payerIds } }, { beneficiaryUserId: user.id }] }
      : { payerUserId: { $in: payerIds } };
  return paymentRepo.listPayments(filter, {
    page: Math.max(1, Number(query.page) || 1),
    limit: Math.min(Math.max(1, Number(query.limit) || 20), 200),
  });
}

async function tutorEarnings(tutorUserId, query) {
  const filter = { beneficiaryUserId: tutorUserId };
  if (query.status) filter.status = query.status;
  else filter.status = PAYMENT_STATUS.PAID;
  if (query.from || query.to) {
    filter.paidAt = {};
    if (query.from) filter.paidAt.$gte = new Date(query.from);
    if (query.to) filter.paidAt.$lte = new Date(query.to);
  }
  return paymentRepo.listPayments(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
}

async function earningsSummary(tutorUserId) {
  const { Payment } = require('./payment.model');
  const walletService = require('../wallet/wallet.service');
  const walletPayload = await walletService.getMyWallet(tutorUserId);
  const paid = await Payment.find({ beneficiaryUserId: tutorUserId, status: PAYMENT_STATUS.PAID })
    .populate('bookingId', 'subjectId startAt')
    .populate({ path: 'bookingId', populate: { path: 'subjectId', select: 'name' } });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lifetimeGross = money(paid.reduce((s, p) => s + p.amount, 0));
  const thisMonthGross = money(
    paid.filter((p) => p.paidAt && p.paidAt >= monthStart).reduce((s, p) => s + p.amount, 0)
  );
  const pending = await Payment.aggregate([
    {
      $match: {
        beneficiaryUserId: new mongoose.Types.ObjectId(String(tutorUserId)),
        status: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.AWAITING_CONFIRMATION] },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const pendingGross = money(pending[0]?.total || 0);
  const monthly = {};
  const subjects = {};
  paid.forEach((p) => {
    const key = (p.paidAt || p.createdAt).toISOString().slice(0, 7);
    monthly[key] = (monthly[key] || 0) + tutorShare(p.amount);
    const name = p.bookingId?.subjectId?.name || p.description || 'Other';
    subjects[name] = (subjects[name] || 0) + tutorShare(p.amount);
  });
  return {
    payoutRate: TUTOR_PAYOUT_RATE,
    lifetimeGross,
    lifetime: tutorShare(lifetimeGross),
    thisMonthGross,
    thisMonth: tutorShare(thisMonthGross),
    pendingPayoutGross: pendingGross,
    pendingPayout: tutorShare(pendingGross),
    withdrawable: walletPayload.wallet.withdrawableBalance,
    locked: walletPayload.wallet.lockedBalance,
    currency: walletPayload.wallet.currency,
    monthlySeries: Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([month, amount]) => ({ month, amount: money(amount) })),
    bySubject: Object.entries(subjects)
      .sort((a, b) => b[1] - a[1])
      .map(([subject, amount]) => ({ subject, amount: money(amount) })),
    billing: walletPayload.billing,
  };
}

async function fulfillPaidPayment(payment) {
  if (payment.resourceId) {
    const resourceService = require('../resource/resource.service');
    await resourceService.recordPurchase(
      payment.payerUserId._id || payment.payerUserId,
      payment.resourceId,
      payment._id
    );
  }
  if (payment.courseId) {
    const courseService = require('../course/course.service');
    await courseService.activateByPayment(payment._id);
  }
  if (payment.projectId) {
    const projectService = require('../project/project.service');
    await projectService.acceptPaid(payment._id);
  }
  if (payment.planId) {
    await activateTutorPremium(payment);
  }
}

async function activateTutorPremium(payment) {
  const plan = await paymentRepo.findPlanById(payment.planId._id || payment.planId);
  if (!plan || plan.audience !== 'tutor') return;
  const userId = payment.payerUserId._id || payment.payerUserId;
  const { dayjs } = require('../../utils/time');
  const months = plan.billingCycle === 'yearly' ? 12 : 1;
  await userRepo.updateTutorProfile(userId, {
    isPremium: true,
    premiumUntil: dayjs().add(months, 'month').toDate(),
    premiumRank: Number(plan.rankBoost || 10),
  });
}

async function pay(user, paymentId, method = 'manual') {
  const payment = await paymentRepo.findPaymentById(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');
  await assertCanPay(user, payment);

  const payable = [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED];
  if (!payable.includes(payment.status)) {
    throw new ApiError(400, `Cannot pay from status ${payment.status}`);
  }
  await assertBookingPayable(payment);

  if (method === 'wallet') {
    // Claim the invoice first so a double click cannot debit twice.
    const claimed = await paymentRepo.transitionPayment(paymentId, payable, {
      status: PAYMENT_STATUS.PAID,
      method: 'wallet',
      paidAt: new Date(),
    });
    if (!claimed) throw new ApiError(409, 'This invoice is already being paid');
    try {
      await walletService.debitPayer(
        user.id,
        payment.amount,
        payment.currency,
        payment.description || 'Wallet payment',
        paymentId
      );
    } catch (err) {
      await paymentRepo.updatePayment(paymentId, {
        status: payment.status,
        method: payment.method,
        $unset: { paidAt: 1 },
      });
      throw err;
    }
    await settleOnce(claimed);
    return paymentRepo.findPaymentById(paymentId);
  }

  const updated = await paymentRepo.transitionPayment(paymentId, payable, {
    status: PAYMENT_STATUS.AWAITING_CONFIRMATION,
    method: 'manual',
  });
  if (!updated) throw new ApiError(409, 'This invoice was updated; refresh and try again');

  const payerId = payment.payerUserId._id || payment.payerUserId;
  await notifyParentsOfStudent(
    payerId,
    'Payment submitted',
    'A payment is awaiting admin confirmation.',
    'payment',
    { paymentId }
  );

  return updated;
}

async function adminSetStatus(paymentId, status, adminNote = '') {
  const allowed = [
    PAYMENT_STATUS.PAID,
    PAYMENT_STATUS.FAILED,
    PAYMENT_STATUS.REFUNDED,
    PAYMENT_STATUS.PENDING,
  ];
  if (!allowed.includes(status)) throw new ApiError(400, 'Invalid payment status');

  const payment = await paymentRepo.findPaymentById(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');
  const nextAllowed = ADMIN_TRANSITIONS[payment.status] || [];
  if (!nextAllowed.includes(status)) {
    throw new ApiError(400, `Cannot change a ${payment.status} payment to ${status}`);
  }
  if (status === PAYMENT_STATUS.PAID) await assertBookingPayable(payment);

  const updated = await paymentRepo.transitionPayment(paymentId, [payment.status], {
    status,
    adminNote,
    ...(status === PAYMENT_STATUS.PAID ? { paidAt: new Date() } : {}),
    ...(status === PAYMENT_STATUS.REFUNDED ? { refundedAt: new Date() } : {}),
  });
  if (!updated) throw new ApiError(409, 'This payment was updated; refresh and try again');

  if (status === PAYMENT_STATUS.PAID) await settleOnce(updated);
  if (status === PAYMENT_STATUS.REFUNDED) await reverseOnRefund(updated, payment);

  const payerId = idOf(payment.payerUserId);
  await notificationService.notify(
    payerId,
    'Payment update',
    `Your payment is now ${status}`,
    'payment',
    { paymentId, status }
  );

  await notifyParentsOfStudent(
    payerId,
    'Payment update',
    `Payment status is now ${status}`,
    'payment',
    { paymentId, status }
  );

  if (payment.beneficiaryUserId && status === PAYMENT_STATUS.PAID) {
    await notificationService.notify(
      idOf(payment.beneficiaryUserId),
      'Payment received',
      'A lesson payment was confirmed by admin',
      'payment',
      { paymentId }
    );
  }

  return updated;
}

// paid -> refunded: take back what settlement credited and return wallet payments to the payer.
async function reverseOnRefund(updated, before) {
  // Payments settled before settledAt existed were still credited, so reverse them too.
  const settlement = updated.settledAt
    ? updated.settlement
    : {
        tutorUserId: idOf(before.beneficiaryUserId),
        ...(before.beneficiaryUserId
          ? walletService.splitAmount(before.amount)
          : { tutorAmt: 0, platformAmt: money(before.amount) }),
      };
  await walletService.reverseSettlement(updated, settlement || {});
  if (before.method === 'wallet') {
    await walletService.refundToPayer(idOf(before.payerUserId), updated);
  }
  if (before.refundRequest?.status) {
    await paymentRepo.updatePayment(updated._id, { 'refundRequest.status': 'refunded' });
  }
  if (updated.beneficiaryUserId) {
    await notificationService.notify(
      idOf(updated.beneficiaryUserId),
      'Refund processed',
      `${updated.description || 'A payment'} was refunded; the payout was reversed.`,
      'payment',
      { paymentId: updated._id }
    );
  }
}

async function adminList(query) {
  const filter = {};
  if (query.status) filter.status = String(query.status);
  if (query.refundStatus) {
    filter['refundRequest.status'] =
      query.refundStatus === 'open'
        ? { $in: ['requested', 'accepted', 'disputed'] }
        : String(query.refundStatus);
  }
  const search = String(query.search || '').trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const users = await User.find({ $or: [{ name: rx }, { phone: rx }] })
      .select('_id')
      .limit(500)
      .lean();
    filter.payerUserId = { $in: users.map((u) => u._id) };
  }
  return paymentRepo.listPayments(filter, {
    page: Math.max(1, Number(query.page) || 1),
    limit: Math.min(Math.max(1, Number(query.limit) || 20), 500),
  });
}

async function adminGet(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Payment not found');
  const payment = await paymentRepo
    .findPaymentById(id)
    .populate('beneficiaryUserId', 'name role refCode');
  if (!payment) throw new ApiError(404, 'Payment not found');
  return payment;
}

async function createPlan(data) {
  return paymentRepo.createPlan(data);
}

async function updatePlan(id, data) {
  const plan = await paymentRepo.updatePlan(id, data);
  if (!plan) throw new ApiError(404, 'Plan not found');
  return plan;
}

async function listPlans(activeOnly = true, audience) {
  const filter = {};
  if (activeOnly) filter.isActive = true;
  if (audience === 'tutor') filter.audience = 'tutor';
  else if (audience === 'student') {
    filter.$or = [{ audience: 'student' }, { audience: { $exists: false } }];
  }
  return paymentRepo.listPlans(filter);
}

async function subscribePlan(user, planId) {
  const plan = await paymentRepo.findPlanById(planId);
  if (!plan || !plan.isActive) throw new ApiError(404, 'Plan not found');
  if (plan.audience === 'tutor' && user.role !== ROLES.TUTOR) {
    throw new ApiError(403, 'This plan is for tutors');
  }
  if (plan.audience === 'student' && user.role === ROLES.TUTOR) {
    throw new ApiError(403, 'This plan is for students');
  }
  const payment = await paymentRepo.createPayment({
    payerUserId: user.id,
    planId,
    amount: plan.price,
    currency: plan.currency,
    method: 'manual',
    status: PAYMENT_STATUS.PENDING,
    description: `Subscription: ${plan.name}`,
  });
  await notificationService.notify(
    payment.payerUserId,
    'Subscription renewal initiated',
    `Invoice created for ${plan.name}. Pay to keep your plan active.`,
    'payment',
    { paymentId: payment._id, planId }
  );
  return payment;
}

async function requestRefund(user, id, body = {}) {
  const payment = await paymentRepo.findPaymentById(id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  await assertCanPay(user, payment);
  if (payment.status !== PAYMENT_STATUS.PAID) throw new ApiError(400, 'Only paid invoices can be refunded');
  if (['requested', 'accepted', 'disputed'].includes(payment.refundRequest?.status)) {
    throw new ApiError(400, 'A refund request is already open for this payment');
  }
  payment.refundRequest = {
    status: 'requested',
    reason: body.reason || 'other',
    note: body.note || '',
    requestedBy: user.id,
    requestedAt: new Date(),
  };
  await payment.save();
  if (payment.beneficiaryUserId) {
    await notificationService.notify(
      payment.beneficiaryUserId.toString(),
      'Refund requested',
      `${payment.description || 'A payment'} has a refund request.`,
      'payment',
      { paymentId: id }
    );
  }
  return payment;
}

async function respondRefund(user, id, body = {}) {
  const payment = await paymentRepo.findPaymentById(id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  const ben = (payment.beneficiaryUserId?._id || payment.beneficiaryUserId || '').toString();
  if (user.role !== ROLES.ADMIN && ben !== user.id) throw new ApiError(403, 'Not allowed');
  if (payment.refundRequest?.status !== 'requested') {
    throw new ApiError(400, 'There is no open refund request to respond to');
  }
  payment.refundRequest = {
    ...(payment.refundRequest || {}),
    status: body.accept ? 'accepted' : 'disputed',
    tutorNote: body.note || '',
  };
  await payment.save();
  return payment;
}

module.exports = {
  listPayable,
  history,
  tutorEarnings,
  earningsSummary,
  pay,
  adminSetStatus,
  adminList,
  adminGet,
  createPlan,
  updatePlan,
  listPlans,
  subscribePlan,
  requestRefund,
  respondRefund,
};
