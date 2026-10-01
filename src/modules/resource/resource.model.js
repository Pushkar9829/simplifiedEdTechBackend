const mongoose = require('mongoose');
const { RESOURCE_ACCESS } = require('../../common/constants');

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    level: { type: String, default: 'HL' },
    topic: { type: String, default: '' },
    chapter: { type: String, default: '' },
    academicYear: { type: String, default: '' },
    type: { type: String, required: true },
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

const reviewSchema = new mongoose.Schema(
  {
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' },
  },
  { timestamps: true }
);
reviewSchema.index({ resourceId: 1, userId: 1 }, { unique: true });

const suggestionSchema = new mongoose.Schema(
  {
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['open', 'reviewed'], default: 'open' },
  },
  { timestamps: true }
);

module.exports = {
  Resource: mongoose.model('Resource', resourceSchema),
  ResourceBookmark: mongoose.model('ResourceBookmark', bookmarkSchema),
  ResourcePurchase: mongoose.model('ResourcePurchase', purchaseSchema),
  ResourceSuggestion: mongoose.model('ResourceSuggestion', suggestionSchema),
  ResourceReview: mongoose.model('ResourceReview', reviewSchema),
};
