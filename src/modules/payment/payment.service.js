const mongoose = require('mongoose');
const paymentRepo = require('./payment.repo');
const parentRepo = require('../parent/parent.repo');
const notificationService = require('../notification/notification.service');
const { notifyParentsOfStudent } = require('../../utils/parentNotify');
const walletService = require('../wallet/wallet.service');
const ApiError = require('../../common/ApiError');
const { PAYMENT_STATUS, ROLES, TUTOR_PAYOUT_RATE } = require('../../common/constants');

function money(n) {
  return Math.round(Number(n || 0) * 100) / 100;
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
  const payerId = payment.payerUserId._id
    ? payment.payerUserId._id.toString()
    : payment.payerUserId.toString();

  if (payerId === user.id) return true;

  if (user.role === ROLES.PARENT) {
    const link = await parentRepo.findLink(user.id, payerId);
    if (link) return true;
  }

  throw new ApiError(403, 'Not allowed to pay this invoice');
}

async function listPayable(user) {
  const payerIds = await getPayablePayerIds(user);
  return paymentRepo.listPayments({
    payerUserId: { $in: payerIds },
    status: {
      $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.AWAITING_CONFIRMATION],
    },
  });
}

async function history(user, query) {
  const payerIds = await getPayablePayerIds(user);
  return paymentRepo.listPayments(
    { payerUserId: { $in: payerIds } },
    { page: Number(query.page) || 1, limit: Number(query.limit) || 20 }
  );
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
}

async function pay(user, paymentId, method = 'manual') {
  const payment = await paymentRepo.findPaymentById(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');
  await assertCanPay(user, payment);

  if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED].includes(payment.status)) {
    throw new ApiError(400, `Cannot pay from status ${payment.status}`);
  }

  if (method === 'wallet') {
    await walletService.debitPayer(
      user.id,
      payment.amount,
      payment.currency,
      payment.description || 'Wallet payment',
      paymentId
    );
    const updated = await paymentRepo.updatePayment(paymentId, {
      status: PAYMENT_STATUS.PAID,
      method: 'wallet',
      paidAt: new Date(),
    });
    if (payment.beneficiaryUserId) {
      await walletService.settlePaidBooking({
        payment: updated,
        tutorUserId: payment.beneficiaryUserId.toString(),
      });
    }
    await fulfillPaidPayment(updated);
    return updated;
  }

  const updated = await paymentRepo.updatePayment(paymentId, {
    status: PAYMENT_STATUS.AWAITING_CONFIRMATION,
    method: 'manual',
  });

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

  const updated = await paymentRepo.updatePayment(paymentId, {
    status,
    adminNote,
    ...(status === PAYMENT_STATUS.PAID ? { paidAt: new Date() } : {}),
  });

  await notificationService.notify(
    payment.payerUserId._id,
    'Payment update',
    `Your payment is now ${status}`,
    'payment',
    { paymentId, status }
  );

  await notifyParentsOfStudent(
    payment.payerUserId._id,
    'Payment update',
    `Payment status is now ${status}`,
    'payment',
    { paymentId, status }
  );

  if (payment.beneficiaryUserId && status === PAYMENT_STATUS.PAID) {
    await notificationService.notify(
      payment.beneficiaryUserId,
      'Payment received',
      'A lesson payment was confirmed by admin',
      'payment',
      { paymentId }
    );
    if (payment.status !== PAYMENT_STATUS.PAID) {
      await walletService.settlePaidBooking({
        payment: updated,
        tutorUserId: payment.beneficiaryUserId.toString(),
      });
      await fulfillPaidPayment(updated);
    }
  }

  return updated;
}

async function adminList(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  return paymentRepo.listPayments(filter, {
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
  });
}

async function createPlan(data) {
  return paymentRepo.createPlan(data);
}

async function updatePlan(id, data) {
  const plan = await paymentRepo.updatePlan(id, data);
  if (!plan) throw new ApiError(404, 'Plan not found');
  return plan;
}

async function listPlans(activeOnly = true) {
  return paymentRepo.listPlans(activeOnly ? { isActive: true } : {});
}

async function subscribePlan(userId, planId) {
  const plan = await paymentRepo.findPlanById(planId);
  if (!plan || !plan.isActive) throw new ApiError(404, 'Plan not found');
  return paymentRepo.createPayment({
    payerUserId: userId,
    planId,
    amount: plan.price,
    currency: plan.currency,
    method: 'manual',
    status: PAYMENT_STATUS.PENDING,
    description: `Subscription: ${plan.name}`,
  });
}

module.exports = {
  listPayable,
  history,
  tutorEarnings,
  earningsSummary,
  pay,
  adminSetStatus,
  adminList,
  createPlan,
  updatePlan,
  listPlans,
  subscribePlan,
};
