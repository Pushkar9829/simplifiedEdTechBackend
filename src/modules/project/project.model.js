const mongoose = require('mongoose');
const { PROJECT_STATUS } = require('../../common/constants');

const fileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: '' },
    mimeType: { type: String, default: '' },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['project', 'assignment'], default: 'project' },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: Object.values(PROJECT_STATUS),
      default: PROJECT_STATUS.PROPOSED,
    },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    deliveryDate: { type: Date, required: true },
    attachments: [fileSchema],
    deliverables: [fileSchema],
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
