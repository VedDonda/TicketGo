const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
    },
    zoneName: {
      type: String,
      required: [true, 'Zone name is required'],
      trim: true,
    },
    totalSeats: {
      type: Number,
      required: [true, 'Total seats is required'],
      min: [1, 'Zone must have at least 1 seat'],
    },
    // availableSeats is decremented atomically via $inc during booking
    // to prevent overselling under concurrent load
    availableSeats: {
      type: Number,
      required: [true, 'Available seats is required'],
      min: [0, 'Available seats cannot be negative'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
  },
  { timestamps: true }
);

// ─── Compound Unique Index ─────────────────────────────────────────────────────
//
// Prevents two inventory documents with the same zone name for the same event.
// Combined with ordered:false in insertMany, worker retries are idempotent.
//
inventorySchema.index({ event: 1, zoneName: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', inventorySchema);
