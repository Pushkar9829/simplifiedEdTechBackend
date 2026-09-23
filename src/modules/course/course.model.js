const mongoose = require('mongoose');
const { COURSE_STATUS, LEVELS } = require('../../common/constants');

const courseSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    level: { type: String, enum: LEVELS, default: 'HL' },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    thumbnail: { type: String, default: '' },
    lessonPlanIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LessonPlan' }],
    status: {
      type: String,
      enum: Object.values(COURSE_STATUS),
      default: COURSE_STATUS.DRAFT,
    },
  },
  { timestamps: true }
);

const courseEnrollmentSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    status: { type: String, enum: ['pending', 'active', 'cancelled'], default: 'pending' },
  },
  { timestamps: true }
);

courseEnrollmentSchema.index({ courseId: 1, studentUserId: 1 }, { unique: true });

module.exports = {
  Course: mongoose.model('Course', courseSchema),
  CourseEnrollment: mongoose.model('CourseEnrollment', courseEnrollmentSchema),
};
