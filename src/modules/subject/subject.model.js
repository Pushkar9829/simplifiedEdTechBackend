const mongoose = require('mongoose');
const { LEVELS } = require('../../common/constants');

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, default: '' },
    levels: { type: [String], enum: LEVELS, default: ['HL', 'SL'] },
    category: { type: String, default: 'general' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subject', subjectSchema);
