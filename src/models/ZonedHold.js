const mongoose = require('mongoose');

/**
 * ZonedHold — tracks a user's temporary reservation of N seats from a zone.
 *
 * Auto-release strategy (two-pronged):
 *  1. MongoDB TTL index deletes this doc when `expiresAt` passes.
 *  2. `getZones` does a lazy-expiry pass that restores `availableSeats` in
 *     Inventory for any hold docs that have expired before MongoDB cleaned them.
 *
 * This means a hold is always cleaned up within ~60 seconds of expiry
 * (MongoDB TTL resolution) with no cron job or Redis required.
 */
const zonedHoldSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    zoneName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    // MongoDB TTL index on this field — doc is auto-deleted after this time
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index: MongoDB removes the document automatically when expiresAt passes
zonedHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Useful for looking up active holds by user + event
zonedHoldSchema.index({ event: 1, user: 1 });

module.exports = mongoose.model('ZonedHold', zonedHoldSchema);
