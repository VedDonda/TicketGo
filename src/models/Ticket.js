// Mongoose schema for Ticket
const mongoose = require("mongoose");
const ticketSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event reference is required"],
    },
    section: {
      type: String,
      required: [true, "Section is required"],
      trim: true,
    },
    row: {
      type: String,
      required: [true, "Row is required"],
      trim: true,
    },
    seatNumber: {
      type: Number,
      required: [true, "Seat number is required"],
      min: [1, "Seat number must be at least 1"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    status: {
      type: String,
      enum: ["AVAILABLE", "HELD", "BOOKED"],
      default: "AVAILABLE",
    },
    heldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    heldUntil: {
      type: Date,
      default: null,
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

ticketSchema.index(
  { event: 1, section: 1, row: 1, seatNumber: 1 },
  { unique: true },
);
ticketSchema.index({ event: 1, status: 1 });
ticketSchema.index({ event: 1, status: 1, heldUntil: 1 });
ticketSchema.index({ bookedBy: 1, event: 1 });
module.exports = mongoose.model("Ticket", ticketSchema);
