const mongoose = require('mongoose');

const progressRecordSchema = new mongoose.Schema(
  {
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    topic: { type: String, default: '' },
    metricType: {
      type: String,
      enum: ['homework', 'mock', 'hours', 'badge', 'general'],
      default: 'general',
    },
    scoreLabel: { type: String, default: '' },
    scoreValue: { type: Number, default: 0 },
    hours: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const badgeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    criteria: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const studentBadgeSchema = new mongoose.Schema(
  {
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    badgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', required: true },
    awardedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

studentBadgeSchema.index({ studentUserId: 1, badgeId: 1 }, { unique: true });

module.exports = {
  ProgressRecord: mongoose.model('ProgressRecord', progressRecordSchema),
  Badge: mongoose.model('Badge', badgeSchema),
  StudentBadge: mongoose.model('StudentBadge', studentBadgeSchema),
};
