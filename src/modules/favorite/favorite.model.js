const mongoose = require('mongoose');

const favoriteItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['tutor', 'course', 'project', 'resource'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

favoriteItemSchema.index({ userId: 1, kind: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('FavoriteItem', favoriteItemSchema);
