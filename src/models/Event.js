// Mongoose schema for Event
const mongoose = require("mongoose");
const seatingConfigSchema = new mongoose.Schema(
  {
    section: { type: String, required: true, trim: true },
    rows: {
      type: Number,
      required: true,
      min: [1, "Rows must be at least 1"],
      max: [100, "Rows cannot exceed 100"],
    },
    seatsPerRow: {
      type: Number,
      required: true,
      min: [1, "Seats per row must be at least 1"],
      max: [100, "Seats per row cannot exceed 100"],
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
  },
  { _id: false },
);
const zoningConfigSchema = new mongoose.Schema(
  {
    zoneName: { type: String, required: true, trim: true },
    totalSeats: {
      type: Number,
      required: true,
      min: [1, "Zone must have at least 1 seat"],
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
  },
  { _id: false },
);
const eventSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Organizer is required"],
    },
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: ["MUSIC", "SPORTS", "COMEDY", "THEATRE", "CONFERENCE", "OTHER"],
        message: "{VALUE} is not a valid category",
      },
    },
    venue: {
      name: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      totalCapacity: { type: Number, required: true, min: 1 },
    },
    date: {
      type: Date,
      required: [true, "Event date is required"],
      validate: {
        validator: (v) => v > new Date(),
        message: "Event date must be in the future",
      },
    },
    eventType: {
      type: String,
      required: [true, "Event type is required"],
      enum: {
        values: ["RESERVED_SEATING", "ZONED_CAPACITY"],
        message: "{VALUE} is not a valid event type",
      },
    },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"],
      default: "DRAFT",
    },
    seatingConfig: {
      type: [seatingConfigSchema],
      default: undefined,
    },
    zoningConfig: {
      type: [zoningConfigSchema],
      default: undefined,
    },
    imageUrl: { type: String },
    hasImage: { type: Boolean, default: false },
  },
  { timestamps: true },
);

eventSchema.index({ status: 1, date: 1 });
eventSchema.index({ organizer: 1, createdAt: -1 });
eventSchema.pre("validate", function () {
  if (this.eventType === "RESERVED_SEATING") {
    if (!this.seatingConfig || this.seatingConfig.length === 0) {
      this.invalidate(
        "seatingConfig",
        "seatingConfig is required for RESERVED_SEATING events",
      );
    }
  }

  if (this.eventType === "ZONED_CAPACITY") {
    if (!this.zoningConfig || this.zoningConfig.length === 0) {
      this.invalidate(
        "zoningConfig",
        "zoningConfig is required for ZONED_CAPACITY events",
      );
    }
  }
});
module.exports = mongoose.model("Event", eventSchema);
