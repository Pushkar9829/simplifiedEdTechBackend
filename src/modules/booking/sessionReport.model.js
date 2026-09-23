const mongoose = require('mongoose');

const sessionReportSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    summary: { type: String, default: '' },
    topicsCovered: [{ type: String }],
    strengths: { type: String, default: '' },
    weaknesses: { type: String, default: '' },
    studentMood: {
      type: String,
      enum: ['', 'engaged', 'neutral', 'distracted', 'anxious', 'confident'],
      default: '',
    },
    understandingRating: { type: Number, min: 1, max: 5 },
    homeworkCompletion: {
      type: String,
      enum: ['', 'done', 'partial', 'not_done', 'none_assigned'],
      default: '',
    },
    nextSteps: { type: String, default: '' },
    // Visible to the tutor only.
    privateNotes: { type: String, default: '' },
    sharedWithParent: { type: Boolean, default: true },
  },
  { timestamps: true }
);

sessionReportSchema.index({ tutorUserId: 1, studentUserId: 1, createdAt: -1 });

module.exports = mongoose.model('SessionReport', sessionReportSchema);
