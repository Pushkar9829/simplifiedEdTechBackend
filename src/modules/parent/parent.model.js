const mongoose = require('mongoose');

const parentStudentLinkSchema = new mongoose.Schema(
  {
    parentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    relationship: { type: String, default: 'parent' },
    status: { type: String, enum: ['active', 'pending', 'revoked'], default: 'active' },
  },
  { timestamps: true }
);

parentStudentLinkSchema.index({ parentUserId: 1, studentUserId: 1 }, { unique: true });

module.exports = mongoose.model('ParentStudentLink', parentStudentLinkSchema);
