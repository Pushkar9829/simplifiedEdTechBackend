const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    audience: {
      type: String,
      enum: ['all', 'student', 'tutor', 'parent', 'admin'],
      default: 'all',
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const platformConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

const campaignMetricSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    channel: { type: String, default: '' },
    spend: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ['general', 'booking', 'payment', 'tutor_dispute', 'complaint'],
      default: 'general',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = {
  Announcement: mongoose.model('Announcement', announcementSchema),
  PlatformConfig: mongoose.model('PlatformConfig', platformConfigSchema),
  CampaignMetric: mongoose.model('CampaignMetric', campaignMetricSchema),
  SupportTicket: mongoose.model('SupportTicket', supportTicketSchema),
};
