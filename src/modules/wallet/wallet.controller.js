const walletService = require('./wallet.service');
const { success, created } = require('../../common/response');
const { asyncHandler } = require('../../utils/asyncHandler');

const me = asyncHandler(async (req, res) => {
  const data = await walletService.getMyWallet(req.user.id);
  return success(res, data);
});

const withdraw = asyncHandler(async (req, res) => {
  const data = await walletService.requestWithdraw(req.user.id, req.body.amount);
  return created(res, data, 'Withdrawal requested');
});

const myWithdrawals = asyncHandler(async (req, res) => {
  const data = await walletService.myWithdrawals(req.user.id);
  return success(res, data);
});

const platform = asyncHandler(async (_req, res) => {
  const data = await walletService.getPlatformWallet();
  return success(res, data);
});

const adminWithdrawals = asyncHandler(async (_req, res) => {
  const data = await walletService.adminWithdrawals();
  return success(res, data);
});

const reviewWithdrawal = asyncHandler(async (req, res) => {
  const data = await walletService.reviewWithdrawal(
    req.params.id,
    req.body.status,
    req.body.adminNote
  );
  return success(res, data, 'Withdrawal updated');
});

const topUp = asyncHandler(async (req, res) => {
  const data = await walletService.topUp(req.body.userId || req.user.id, req.body.amount);
  return success(res, data, 'Wallet topped up');
});

const saveBank = asyncHandler(async (req, res) => {
  const data = await walletService.saveBankAccount(req.user.id, req.body);
  return success(res, data, 'Bank account saved');
});

const verifyBank = asyncHandler(async (req, res) => {
  const data = await walletService.verifyBankAccount(req.user.id);
  return success(res, data, data.bankAccount?.status === 'verified' ? 'Bank verified' : 'Verification failed');
});

module.exports = {
  me,
  withdraw,
  myWithdrawals,
  platform,
  adminWithdrawals,
  reviewWithdrawal,
  topUp,
  saveBank,
  verifyBank,
};
