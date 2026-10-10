const mongoose = require('mongoose');

const userBlockSchema = new mongoose.Schema(
  {
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, default: '' },
  },
  { timestamps: true }
);

userBlockSchema.index({ byUserId: 1, targetUserId: 1 }, { unique: true });

module.exports = mongoose.model('UserBlock', userBlockSchema);
