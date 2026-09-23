const crypto = require('crypto');
const walletRepo = require('./wallet.repo');
const cmsRepo = require('../cms/cms.repo');
const payouts = require('../../integrations/payouts');
const env = require('../../config/env');
const { dayjs } = require('../../utils/time');
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

function aesKey() {
  return crypto.createHash('sha256').update(String(env.bankEncryptionKey)).digest();
}

function encryptAccount(number) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey(), iv);
  const enc = Buffer.concat([cipher.update(String(number), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
}

function decryptAccount(payload) {
  if (!payload) return '';
  const [iv, tag, enc] = String(payload).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(Buffer.from(enc, 'hex')) + decipher.final('utf8');
}

function publicBank(account) {
  if (!account) return null;
  const row = typeof account.toObject === 'function' ? account.toObject() : { ...account };
  delete row.accountNumberEnc;
  return row;
}

function currentCycle(date = new Date()) {
  return dayjs(date).format('YYYY-MM');
}

function cycleEnd(date = new Date()) {
  return dayjs(date).endOf('month').toDate();
}

async function withdrawWindow(now = dayjs()) {
  const startCfg = await cmsRepo.getConfig('withdraw_window_start_day');
  const endCfg = await cmsRepo.getConfig('withdraw_window_end_day');
  const last = now.endOf('month').date();
  const startDay = Number(startCfg?.value ?? last - 2);
  const endDay = Number(endCfg?.value ?? last);
  const start = Math.min(Math.max(1, startDay), last);
  const end = Math.min(Math.max(start, endDay), last);
  const day = now.date();
  return {
    startDay: start,
    endDay: end,
    inWindow: day >= start && day <= end,
    nextWindowStart: now.date(start).startOf('day').toDate(),
    cycle: currentCycle(now.toDate()),
  };
}

async function balances(wallet) {
  const credits = await walletRepo.listAllCredits(wallet._id);
  const now = new Date();
  const locked = money(
    credits
      .filter((t) => t.availableAt && new Date(t.availableAt) > now)
      .reduce((s, t) => s + t.amount, 0)
  );
  return {
    balance: money(wallet.balance),
    lockedBalance: Math.min(locked, money(wallet.balance)),
    withdrawableBalance: money(Math.max(0, wallet.balance - locked)),
  };
}

async function getMyWallet(userId) {
  const wallet = await walletRepo.upsertUserWallet(userId);
  const tx = await walletRepo.listTx(wallet._id, { page: 1, limit: 30 });
  const bank = await walletRepo.findBankAccount(userId);
  const window = await withdrawWindow();
  const split = await balances(wallet);
  return {
    wallet: { ...wallet.toObject(), ...split },
    transactions: tx,
    bankAccount: publicBank(bank),
    billing: window,
  };
}

async function getPlatformWallet() {
  const wallet = await walletRepo.upsertPlatformWallet();
  const tx = await walletRepo.listTx(wallet._id, { page: 1, limit: 50 });
  return { wallet, transactions: tx };
}

async function credit(wallet, amount, description, refType, refId, extra = {}) {
  const next = await walletRepo.adjustBalance(wallet._id, money(amount));
  await walletRepo.addTx({
    walletId: wallet._id,
    type: WALLET_TX_TYPE.CREDIT,
    amount: money(amount),
    description,
    refType,
    refId,
    ...extra,
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
  const extra = { cycle: currentCycle(), availableAt: cycleEnd() };
  await credit(tutorWallet, tutorAmt, 'Lesson payout (75%)', 'payment', ref, extra);
  await credit(platformWallet, platformAmt, 'Platform commission (25%)', 'payment', ref);
  return { tutorAmt, platformAmt };
}

async function debitPayer(userId, amount, currency, description, refId) {
  const wallet = await walletRepo.upsertUserWallet(userId, currency);
  return debit(wallet, amount, description, 'payment', refId);
}

async function saveBankAccount(userId, body) {
  const accountNumber = String(body.accountNumber || '').replace(/\s+/g, '');
  if (accountNumber && !/^\d{9,18}$/.test(accountNumber)) {
    throw new ApiError(400, 'Account number must be 9–18 digits');
  }
  const ifsc = String(body.ifsc || '').toUpperCase();
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    throw new ApiError(400, 'IFSC must look like SBIN0001234');
  }
  const existing = await walletRepo.findBankAccount(userId);
  const account = await walletRepo.upsertBankAccount(userId, {
    holderName: body.holderName,
    accountNumberEnc: accountNumber ? encryptAccount(accountNumber) : existing?.accountNumberEnc || '',
    last4: accountNumber ? accountNumber.slice(-4) : existing?.last4 || '',
    ifsc,
    bankName: body.bankName || '',
    upiId: body.upiId || '',
    status: 'unverified',
    failReason: '',
    verifiedAt: undefined,
  });
  return publicBank(account);
}

async function verifyBankAccount(userId) {
  const account = await walletRepo.findBankAccount(userId);
  if (!account) throw new ApiError(400, 'Add bank details first');
  const number = decryptAccount(account.accountNumberEnc);
  const result = await payouts.verifyBankAccount({
    holderName: account.holderName,
    accountNumber: number,
    ifsc: account.ifsc,
    reference: userId,
  });
  account.status = result.status;
  account.providerRef = result.providerRef || '';
  account.fundAccountId = result.fundAccountId || account.fundAccountId;
  account.failReason = result.reason || '';
  if (result.status === 'verified') account.verifiedAt = new Date();
  await account.save();
  return { bankAccount: publicBank(account), verification: result };
}

async function requestWithdraw(tutorUserId, amount) {
  const window = await withdrawWindow();
  if (!window.inWindow) {
    throw new ApiError(
      400,
      `Withdrawals open on days ${window.startDay}–${window.endDay} of each month`
    );
  }
  const bank = await walletRepo.findBankAccount(tutorUserId);
  if (!bank || bank.status !== 'verified') {
    throw new ApiError(400, 'Verify a bank account with the ₹1 check before withdrawing');
  }
  const wallet = await walletRepo.upsertUserWallet(tutorUserId);
  const split = await balances(wallet);
  if (split.withdrawableBalance < money(amount) - 0.001) {
    throw new ApiError(400, `You can withdraw up to ${split.withdrawableBalance} this cycle`);
  }
  const existing = await walletRepo.listWithdrawals({ tutorUserId, cycle: window.cycle });
  if (existing.some((w) => ['pending', 'approved'].includes(w.status))) {
    throw new ApiError(400, 'You already have a withdrawal for this billing cycle');
  }
  return walletRepo.createWithdrawal({
    tutorUserId,
    amount: money(amount),
    currency: wallet.currency,
    status: WITHDRAWAL_STATUS.PENDING,
    bankAccountId: bank._id,
    cycle: window.cycle,
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
  const patch = { status, adminNote };
  if (status === WITHDRAWAL_STATUS.APPROVED) {
    const tutorId = existing.tutorUserId._id || existing.tutorUserId;
    const wallet = await walletRepo.upsertUserWallet(tutorId);
    await debit(wallet, existing.amount, 'Withdrawal', 'withdrawal', id);
    const bank = existing.bankAccountId
      ? await walletRepo.findBankAccountById(existing.bankAccountId)
      : await walletRepo.findBankAccount(tutorId);
    if (bank) {
      const sent = await payouts.sendPayout({
        amount: existing.amount,
        currency: existing.currency,
        holderName: bank.holderName,
        accountNumber: decryptAccount(bank.accountNumberEnc),
        ifsc: bank.ifsc,
        fundAccountId: bank.fundAccountId,
        reference: id,
      });
      patch.payoutRef = sent.payoutRef;
    }
  }
  return walletRepo.updateWithdrawal(id, patch);
}

async function topUp(userId, amount, currency = 'USD') {
  const wallet = await walletRepo.upsertUserWallet(userId, currency);
  await credit(wallet, amount, 'Wallet top-up (manual)', 'topup', userId, {
    cycle: currentCycle(),
    availableAt: new Date(),
  });
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
  saveBankAccount,
  verifyBankAccount,
  money,
};
