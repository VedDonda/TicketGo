const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
    },
    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true,
    },
    row: {
      type: String,
      required: [true, 'Row is required'],
      trim: true,
    },
    seatNumber: {
      type: Number,
      required: [true, 'Seat number is required'],
      min: [1, 'Seat number must be at least 1'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'HELD', 'BOOKED'],
      default: 'AVAILABLE',
    },
    // Set when a user initiates checkout — provides a time-limited hold
    heldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    heldUntil: {
      type: Date,
      default: null,
    },
    // Set permanently when purchase is confirmed
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Compound Unique Index ─────────────────────────────────────────────────────
//
// This is the concurrency lock at the database level.
// It is mathematically impossible to insert two tickets with the same
// (event, section, row, seatNumber) combination. This protects against:
//   - Race conditions from concurrent API requests
//   - Worker retries / double-processing
//   - Any future backend bugs
//
ticketSchema.index(
  { event: 1, section: 1, row: 1, seatNumber: 1 },
  { unique: true }
);

// Index for quickly fetching all available seats for an event
ticketSchema.index({ event: 1, status: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
