const { Wallet, WalletTransaction, Withdrawal } = require('./wallet.model');
const { WALLET_OWNER } = require('../../common/constants');

async function findUserWallet(userId) {
  return Wallet.findOne({ ownerType: WALLET_OWNER.USER, ownerUserId: userId });
}

async function findPlatformWallet() {
  return Wallet.findOne({ ownerType: WALLET_OWNER.PLATFORM, ownerUserId: null });
}

async function upsertUserWallet(userId, currency = 'USD') {
  return Wallet.findOneAndUpdate(
    { ownerType: WALLET_OWNER.USER, ownerUserId: userId },
    { $setOnInsert: { ownerType: WALLET_OWNER.USER, ownerUserId: userId, balance: 0, currency } },
    { upsert: true, new: true }
  );
}

async function upsertPlatformWallet(currency = 'USD') {
  return Wallet.findOneAndUpdate(
    { ownerType: WALLET_OWNER.PLATFORM, ownerUserId: null },
    { $setOnInsert: { ownerType: WALLET_OWNER.PLATFORM, ownerUserId: null, balance: 0, currency } },
    { upsert: true, new: true }
  );
}

async function adjustBalance(walletId, delta) {
  return Wallet.findByIdAndUpdate(walletId, { $inc: { balance: delta } }, { new: true });
}

async function addTx(data) {
  return WalletTransaction.create(data);
}

async function listTx(walletId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    WalletTransaction.find({ walletId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    WalletTransaction.countDocuments({ walletId }),
  ]);
  return { items, total, page, limit };
}

async function createWithdrawal(data) {
  return Withdrawal.create(data);
}

async function listWithdrawals(filter = {}) {
  return Withdrawal.find(filter).sort({ createdAt: -1 }).populate('tutorUserId', 'name phone');
}

async function findWithdrawalById(id) {
  return Withdrawal.findById(id).populate('tutorUserId', 'name phone');
}

async function updateWithdrawal(id, data) {
  return Withdrawal.findByIdAndUpdate(id, data, { new: true });
}

module.exports = {
  findUserWallet,
  findPlatformWallet,
  upsertUserWallet,
  upsertPlatformWallet,
  adjustBalance,
  addTx,
  listTx,
  createWithdrawal,
  listWithdrawals,
  findWithdrawalById,
  updateWithdrawal,
};
