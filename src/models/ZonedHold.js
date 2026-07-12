// Mongoose schema for temporary zoned holds
const mongoose = require("mongoose");
const zonedHoldSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      min: [1, "Quantity must be at least 1"],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

zonedHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
zonedHoldSchema.index({ event: 1, user: 1 });
module.exports = mongoose.model("ZonedHold", zonedHoldSchema);
