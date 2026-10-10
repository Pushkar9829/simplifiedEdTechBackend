const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Home' },
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    area: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    postalCode: { type: String, default: '' },
    country: { type: String, default: '' },
    landmark: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: true }
);

const emergencySchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    relationship: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  { _id: false }
);

const identitySchema = new mongoose.Schema(
  {
    type: { type: String, default: '' },
    number: { type: String, default: '' },
    documentUrl: { type: String, default: '' },
    status: { type: String, default: 'unverified' },
  },
  { _id: false }
);

const gstSchema = new mongoose.Schema(
  {
    hasGst: { type: Boolean, default: false },
    type: { type: String, default: 'GSTIN' },
    number: { type: String, default: '' },
    legalName: { type: String, default: '' },
    registeredAddress: { type: String, default: '' },
    certificateUrl: { type: String, default: '' },
    status: { type: String, default: 'unverified' },
    checkedAt: { type: Date },
    portalNote: { type: String, default: '' },
  },
  { _id: false }
);

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
    progressCredits: { type: Number, default: 0 },
    progressStars: { type: Number, default: 0 },
    progressLevel: { type: String, default: 'Starter' },
    dateOfBirth: { type: Date },
    sex: { type: String, default: '' },
    preferredCurrency: { type: String, default: '' },
    introPageUrl: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },
    addresses: [addressSchema],
    emergencyContact: { type: emergencySchema, default: () => ({}) },
    identity: { type: identitySchema, default: () => ({}) },
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
    needBasedClasses: { type: Boolean, default: true },
    location: {
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      area: { type: String, default: '' },
      address: { type: String, default: '' },
      lat: { type: Number },
      lng: { type: Number },
    },
    currentAddress: { type: addressSchema, default: () => ({}) },
    permanentAddress: { type: addressSchema, default: () => ({}) },
    currency: { type: String, default: 'USD' },
    dateOfBirth: { type: Date },
    sex: { type: String, default: '' },
    introPageUrl: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },
    emergencyContact: { type: emergencySchema, default: () => ({}) },
    identity: { type: identitySchema, default: () => ({}) },
    gst: { type: gstSchema, default: () => ({}) },
    meetingProvider: { type: String, default: 'zoom' },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    isPremium: { type: Boolean, default: false, index: true },
    premiumUntil: { type: Date },
    premiumRank: { type: Number, default: 0 },
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
    introPageUrl: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },
    emergencyContact: { type: emergencySchema, default: () => ({}) },
    identity: { type: identitySchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = {
  StudentProfile: mongoose.model('StudentProfile', studentProfileSchema),
  TutorProfile: mongoose.model('TutorProfile', tutorProfileSchema),
  ParentProfile: mongoose.model('ParentProfile', parentProfileSchema),
  addressSchema,
};
