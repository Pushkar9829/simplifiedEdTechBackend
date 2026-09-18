const mongoose = require('mongoose');
const { BOOKING_STATUS, LEVELS } = require('../../common/constants');

const bookingSchema = new mongoose.Schema(
  {
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tutorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    level: { type: String, enum: LEVELS, default: 'HL' },
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'AvailabilitySlot' },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, default: 'UTC' },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.PENDING,
    },
    isRecurring: { type: Boolean, default: false },
    recurrenceRule: {
      frequency: { type: String, enum: ['weekly', 'none'], default: 'none' },
      count: { type: Number, default: 1 },
    },
    parentBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    bookedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deliveryMode: { type: String, enum: ['online', 'offline'], default: 'online' },
    meetingUrl: { type: String, default: '' },
    notes: { type: String, default: '' },
    attendance: {
      type: String,
      enum: ['pending', 'present', 'absent'],
      default: 'pending',
    },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },
  { timestamps: true }
);

bookingSchema.index({ tutorUserId: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
