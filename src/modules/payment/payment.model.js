const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../../common/constants');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    billingCycle: { type: String, enum: ['one_time', 'monthly', 'yearly'], default: 'one_time' },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const paymentSchema = new mongoose.Schema(
  {
    payerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    beneficiaryUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    method: { type: String, default: 'manual' },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    description: { type: String, default: '' },
    paidAt: { type: Date },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = {
  SubscriptionPlan: mongoose.model('SubscriptionPlan', subscriptionPlanSchema),
  Payment: mongoose.model('Payment', paymentSchema),
};
