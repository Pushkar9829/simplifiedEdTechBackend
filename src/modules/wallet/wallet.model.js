const mongoose = require('mongoose');
const { WALLET_OWNER, WALLET_TX_TYPE, WITHDRAWAL_STATUS } = require('../../common/constants');

const walletSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      enum: Object.values(WALLET_OWNER),
      required: true,
    },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },
  { timestamps: true }
);

walletSchema.index({ ownerType: 1, ownerUserId: 1 }, { unique: true });

const walletTransactionSchema = new mongoose.Schema(
  {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    type: { type: String, enum: Object.values(WALLET_TX_TYPE), required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: '' },
    refType: { type: String, default: '' },
    refId: { type: String, default: '' },
    cycle: { type: String, default: '' },
    availableAt: { type: Date },
  },
  { timestamps: true }
);

const bankAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    holderName: { type: String, required: true },
    accountNumberEnc: { type: String, default: '' },
    last4: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    bankName: { type: String, default: '' },
    upiId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'failed'],
      default: 'unverified',
    },
    providerRef: { type: String, default: '' },
    fundAccountId: { type: String, default: '' },
    verifiedAt: { type: Date },
    failReason: { type: String, default: '' },
  },
  { timestamps: true }
);

const withdrawalSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: {
      type: String,
      enum: Object.values(WITHDRAWAL_STATUS),
      default: WITHDRAWAL_STATUS.PENDING,
    },
    adminNote: { type: String, default: '' },
    bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },
    cycle: { type: String, default: '' },
    payoutRef: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = {
  Wallet: mongoose.model('Wallet', walletSchema),
  WalletTransaction: mongoose.model('WalletTransaction', walletTransactionSchema),
  BankAccount: mongoose.model('BankAccount', bankAccountSchema),
  Withdrawal: mongoose.model('Withdrawal', withdrawalSchema),
};
