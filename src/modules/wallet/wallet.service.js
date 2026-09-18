const walletRepo = require('./wallet.repo');
const ApiError = require('../../common/ApiError');
const {
  WALLET_TX_TYPE,
  WITHDRAWAL_STATUS,
  PLATFORM_COMMISSION_RATE,
  TUTOR_PAYOUT_RATE,
} = require('../../common/constants');

function money(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function getMyWallet(userId) {
  const wallet = await walletRepo.upsertUserWallet(userId);
  const tx = await walletRepo.listTx(wallet._id, { page: 1, limit: 30 });
  return { wallet, transactions: tx };
}

async function getPlatformWallet() {
  const wallet = await walletRepo.upsertPlatformWallet();
  const tx = await walletRepo.listTx(wallet._id, { page: 1, limit: 50 });
  return { wallet, transactions: tx };
}

async function credit(wallet, amount, description, refType, refId) {
  const next = await walletRepo.adjustBalance(wallet._id, money(amount));
  await walletRepo.addTx({
    walletId: wallet._id,
    type: WALLET_TX_TYPE.CREDIT,
    amount: money(amount),
    description,
    refType,
    refId,
  });
  return next;
}

async function debit(wallet, amount, description, refType, refId) {
  if (wallet.balance < money(amount) - 0.001) {
    throw new ApiError(400, 'Insufficient wallet balance');
  }
  const next = await walletRepo.adjustBalance(wallet._id, -money(amount));
  await walletRepo.addTx({
    walletId: wallet._id,
    type: WALLET_TX_TYPE.DEBIT,
    amount: money(amount),
    description,
    refType,
    refId,
  });
  return next;
}

async function settlePaidBooking({ payment, tutorUserId }) {
  const amount = money(payment.amount);
  const platformAmt = money(amount * PLATFORM_COMMISSION_RATE);
  const tutorAmt = money(amount * TUTOR_PAYOUT_RATE);
  const tutorWallet = await walletRepo.upsertUserWallet(tutorUserId, payment.currency);
  const platformWallet = await walletRepo.upsertPlatformWallet(payment.currency);
  const ref = payment._id.toString();
  await credit(tutorWallet, tutorAmt, 'Lesson payout (75%)', 'payment', ref);
  await credit(platformWallet, platformAmt, 'Platform commission (25%)', 'payment', ref);
  return { tutorAmt, platformAmt };
}

async function debitPayer(userId, amount, currency, description, refId) {
  const wallet = await walletRepo.upsertUserWallet(userId, currency);
  return debit(wallet, amount, description, 'payment', refId);
}

async function requestWithdraw(tutorUserId, amount) {
  const wallet = await walletRepo.upsertUserWallet(tutorUserId);
  if (wallet.balance < money(amount) - 0.001) {
    throw new ApiError(400, 'Insufficient wallet balance');
  }
  return walletRepo.createWithdrawal({
    tutorUserId,
    amount: money(amount),
    currency: wallet.currency,
    status: WITHDRAWAL_STATUS.PENDING,
  });
}

async function myWithdrawals(tutorUserId) {
  return walletRepo.listWithdrawals({ tutorUserId });
}

async function adminWithdrawals() {
  return walletRepo.listWithdrawals({});
}

async function reviewWithdrawal(id, status, adminNote = '') {
  if (![WITHDRAWAL_STATUS.APPROVED, WITHDRAWAL_STATUS.REJECTED].includes(status)) {
    throw new ApiError(400, 'Invalid withdrawal status');
  }
  const existing = await walletRepo.findWithdrawalById(id);
  if (!existing) throw new ApiError(404, 'Withdrawal not found');
  if (existing.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new ApiError(400, 'Withdrawal already reviewed');
  }
  if (status === WITHDRAWAL_STATUS.APPROVED) {
    const wallet = await walletRepo.upsertUserWallet(existing.tutorUserId._id || existing.tutorUserId);
    await debit(wallet, existing.amount, 'Withdrawal', 'withdrawal', id);
  }
  return walletRepo.updateWithdrawal(id, { status, adminNote });
}

async function topUp(userId, amount, currency = 'USD') {
  const wallet = await walletRepo.upsertUserWallet(userId, currency);
  await credit(wallet, amount, 'Wallet top-up (manual)', 'topup', userId);
  return walletRepo.findUserWallet(userId);
}

module.exports = {
  getMyWallet,
  getPlatformWallet,
  settlePaidBooking,
  debitPayer,
  requestWithdraw,
  myWithdrawals,
  adminWithdrawals,
  reviewWithdrawal,
  topUp,
  money,
};
