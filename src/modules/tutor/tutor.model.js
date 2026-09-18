const mongoose = require('mongoose');
const { LEVELS, VERIFICATION_STATUS } = require('../../common/constants');

const tutorSubjectSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    level: { type: String, enum: LEVELS, default: 'HL' },
    hourlyRate: { type: Number, default: 0 },
    onlineRate: { type: Number, default: 0 },
    offlineRate: { type: Number, default: 0 },
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
    classLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassLevel' },
  },
  { timestamps: true }
);

tutorSubjectSchema.index({ tutorUserId: 1, subjectId: 1, level: 1 }, { unique: true });

const availabilitySlotSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, default: 'UTC' },
    deliveryMode: { type: String, enum: ['online', 'offline'], default: 'online' },
    isBooked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const tutorVerificationSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    identityDoc: { type: String, default: '' },
    degreeDoc: { type: String, default: '' },
    certificateDoc: { type: String, default: '' },
    resumeDoc: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.PENDING,
    },
    adminNote: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

const tutorReviewSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' },
  },
  { timestamps: true }
);

const studentNoteSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    note: { type: String, required: true },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

const lessonPlanSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    title: { type: String, required: true },
    objectives: { type: String, default: '' },
    content: { type: String, default: '' },
    resources: [{ type: String }],
    scheduledFor: { type: Date },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    status: {
      type: String,
      enum: ['draft', 'ready', 'completed'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

const tutorVideoSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    kind: { type: String, enum: ['intro', 'sample'], default: 'intro' },
    fileUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = {
  TutorSubject: mongoose.model('TutorSubject', tutorSubjectSchema),
  AvailabilitySlot: mongoose.model('AvailabilitySlot', availabilitySlotSchema),
  TutorVerification: mongoose.model('TutorVerification', tutorVerificationSchema),
  TutorReview: mongoose.model('TutorReview', tutorReviewSchema),
  StudentNote: mongoose.model('StudentNote', studentNoteSchema),
  LessonPlan: mongoose.model('LessonPlan', lessonPlanSchema),
  TutorVideo: mongoose.model('TutorVideo', tutorVideoSchema),
};
