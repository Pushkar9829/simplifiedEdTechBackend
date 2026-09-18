const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    school: { type: String, default: '' },
    gradeYear: { type: String, default: '' },
    subjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
    classLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassLevel' },
    studyStreak: { type: Number, default: 0 },
    lastActivityDate: { type: String, default: '' },
    predictedGrades: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

const tutorProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    qualifications: { type: String, default: '' },
    university: { type: String, default: '' },
    degree: { type: String, default: '' },
    experienceYears: { type: Number, default: 0 },
    languages: [{ type: String }],
    bio: { type: String, default: '' },
    hourlyRate: { type: Number, default: 0 },
    hourlyRateOnline: { type: Number, default: 0 },
    hourlyRateOffline: { type: Number, default: 0 },
    teachingMode: {
      type: String,
      enum: ['online', 'offline', 'both'],
      default: 'both',
    },
    location: {
      city: { type: String, default: '' },
      area: { type: String, default: '' },
      address: { type: String, default: '' },
      lat: { type: Number },
      lng: { type: Number },
    },
    currency: { type: String, default: 'USD' },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    trialLessonAvailable: { type: Boolean, default: true },
    verificationStatus: {
      type: String,
      enum: ['not_submitted', 'pending', 'approved', 'rejected'],
      default: 'not_submitted',
    },
  },
  { timestamps: true }
);

const parentProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = {
  StudentProfile: mongoose.model('StudentProfile', studentProfileSchema),
  TutorProfile: mongoose.model('TutorProfile', tutorProfileSchema),
  ParentProfile: mongoose.model('ParentProfile', parentProfileSchema),
};
