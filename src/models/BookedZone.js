const mongoose = require('mongoose');

const bookedZoneSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    bookedBy: {
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
    price: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

bookedZoneSchema.index({ event: 1, bookedBy: 1 });
bookedZoneSchema.index({ bookedBy: 1, event: 1 });

module.exports = mongoose.model('BookedZone', bookedZoneSchema);
