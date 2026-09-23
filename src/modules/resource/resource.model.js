const mongoose = require('mongoose');
const { RESOURCE_TYPES, RESOURCE_ACCESS, LEVELS } = require('../../common/constants');

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    level: { type: String, enum: LEVELS, default: 'HL' },
    topic: { type: String, default: '' },
    chapter: { type: String, default: '' },
    academicYear: { type: String, default: '' },
    type: { type: String, enum: RESOURCE_TYPES, required: true },
    fileUrl: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
    accessType: { type: String, enum: Object.values(RESOURCE_ACCESS), default: RESOURCE_ACCESS.FREE },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    isDownloadable: { type: Boolean, default: true },
    downloadableUntil: { type: Date },
  },
  { timestamps: true }
);

resourceSchema.index({ title: 'text', topic: 'text', chapter: 'text' });

const bookmarkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
  },
  { timestamps: true }
);

bookmarkSchema.index({ userId: 1, resourceId: 1 }, { unique: true });

const purchaseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  },
  { timestamps: true }
);

purchaseSchema.index({ userId: 1, resourceId: 1 }, { unique: true });

module.exports = {
  Resource: mongoose.model('Resource', resourceSchema),
  ResourceBookmark: mongoose.model('ResourceBookmark', bookmarkSchema),
  ResourcePurchase: mongoose.model('ResourcePurchase', purchaseSchema),
};
