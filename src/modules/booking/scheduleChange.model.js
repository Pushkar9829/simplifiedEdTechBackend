const mongoose = require('mongoose');

const scheduleChangeSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    initiatedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    initiatedByRole: { type: String, enum: ['student', 'parent', 'tutor', 'admin'], required: true },
    kind: { type: String, enum: ['reschedule', 'cancel'], required: true },
    status: {
      type: String,
      enum: [
        'pending',
        'slots_offered',
        'awaiting_replacement',
        'awaiting_approval',
        'confirmed',
        'declined',
        'consumed',
      ],
      default: 'pending',
      index: true,
    },
    reason: { type: String, default: '' },
    noticeHours: { type: Number, default: 0 },
    late: { type: Boolean, default: false },
    countsAgainstMonthly: { type: Boolean, default: false },
    cycle: { type: String, default: '' },
    offeredSlotIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AvailabilitySlot' }],
    selectedSlotId: { type: mongoose.Schema.Types.ObjectId, ref: 'AvailabilitySlot' },
    replacementTutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScheduleChange', scheduleChangeSchema);
