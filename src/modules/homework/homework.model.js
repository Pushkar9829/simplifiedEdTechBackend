const mongoose = require('mongoose');
const { ASSIGNMENT_STATUS, GRADING_SCHEMES, LEVELS } = require('../../common/constants');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    level: { type: String, enum: LEVELS, default: 'HL' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    deadline: { type: Date, required: true },
    resourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
    attachments: [attachmentSchema],
    rubric: { type: String, default: '' },
    gradingScheme: { type: String, enum: GRADING_SCHEMES, default: 'ib_1_7' },
    maxScore: { type: Number },
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUS),
      default: ASSIGNMENT_STATUS.ASSIGNED,
    },
  },
  { timestamps: true }
);

const submissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    files: [mongoose.Schema.Types.Mixed],
    notes: { type: String, default: '' },
    // Structured { scheme, value, maxScore, percentage, ibEquivalent, label }; legacy rows hold a string.
    grade: { type: mongoose.Schema.Types.Mixed, default: '' },
    feedback: { type: String, default: '' },
    versionHistory: [
      {
        files: [mongoose.Schema.Types.Mixed],
        notes: String,
        submittedAt: { type: Date, default: Date.now },
      },
    ],
    gradedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = {
  Assignment: mongoose.model('Assignment', assignmentSchema),
  Submission: mongoose.model('Submission', submissionSchema),
};
