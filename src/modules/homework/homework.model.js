const mongoose = require('mongoose');
const { ASSIGNMENT_STATUS, LEVELS } = require('../../common/constants');

const assignmentSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    level: { type: String, enum: LEVELS, default: 'HL' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    deadline: { type: Date, required: true },
    resourceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
    rubric: { type: String, default: '' },
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
    files: [{ type: String }],
    notes: { type: String, default: '' },
    grade: { type: String, default: '' },
    feedback: { type: String, default: '' },
    versionHistory: [
      {
        files: [String],
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
