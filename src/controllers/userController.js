const User = require("../models/User");
const Ticket = require("../models/Ticket");
const Event = require("../models/Event");
const Inventory = require("../models/Inventory");
const bcrypt = require("bcryptjs");

const getMyBookings = async (req, res) => {
  try {
    // Fetch reserved seating bookings for the user
    const tickets = await Ticket.find({
      bookedBy: req.user._id,
      status: "BOOKED",
    })
      .populate({
        path: "event",
        select: "title date venue category eventType status hasImage",
      })
      .sort({ createdAt: -1 })
      .lean();
    const eventMap = {};

    for (const t of tickets) {
      if (!t.event) continue;
      const eId = t.event._id.toString();

      if (!eventMap[eId]) {
        if (t.event.hasImage) t.event.imageUrl = `/api/events/${eId}/image`;
        eventMap[eId] = {
          event: t.event,
          type: "RESERVED_SEATING",
          tickets: [],
          totalPrice: 0,
          bookedAt: t.createdAt,
        };
      }

      eventMap[eId].tickets.push({
        _id: t._id,
        section: t.section,
        row: t.row,
        seatNumber: t.seatNumber,
        price: t.price,
        createdAt: t.createdAt,
      });
      eventMap[eId].totalPrice += t.price;

      if (new Date(t.createdAt) > new Date(eventMap[eId].bookedAt)) {
        eventMap[eId].bookedAt = t.createdAt;
      }
    }

    // Fetch zoned capacity bookings for the user
    const BookedZone = require("../models/BookedZone");
    const zonedBookings = await BookedZone.find({ bookedBy: req.user._id })
      .populate({
        path: "event",
        select: "title date venue category eventType status hasImage",
      })
      .sort({ createdAt: -1 })
      .lean();

    for (const bz of zonedBookings) {
      if (!bz.event) continue;
      const eId = bz.event._id.toString();

      if (!eventMap[eId]) {
        if (bz.event.hasImage) bz.event.imageUrl = `/api/events/${eId}/image`;
        eventMap[eId] = {
          event: bz.event,
          type: "ZONED_CAPACITY",
          tickets: [],
          totalPrice: 0,
          bookedAt: bz.createdAt,
        };
      }

      eventMap[eId].tickets.push({
        _id: bz._id,
        isZone: true,
        section: bz.zoneName,
        quantity: bz.quantity,
        price: bz.price * bz.quantity,
        createdAt: bz.createdAt,
      });
      eventMap[eId].totalPrice += bz.price * bz.quantity;

      if (new Date(bz.createdAt) > new Date(eventMap[eId].bookedAt)) {
        eventMap[eId].bookedAt = bz.createdAt;
      }
    }

    const bookings = Object.values(eventMap).sort(
      (a, b) => new Date(b.bookedAt) - new Date(a.bookedAt),
    );

    return res.status(200).json({ success: true, data: { bookings } });
  } catch (error) {
    console.error("[UserController] getMyBookings error:", error);

    return res
      .status(500)
      .json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      });
  }
};

// Fetch current user's profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("[UserController] getProfile error:", error);

    return res
      .status(500)
      .json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { name: name.trim() } },
      { new: true, runValidators: true },
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);

      return res
        .status(400)
        .json({ success: false, message: messages.join(", ") });
    }

    console.error("[UserController] updateProfile error:", error);

    return res
      .status(500)
      .json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Both currentPassword and newPassword are required",
        });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({
          success: false,
          message: "New password must be at least 6 characters",
        });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("[UserController] changePassword error:", error);

    return res
      .status(500)
      .json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      });
  }
};

module.exports = { getMyBookings, getProfile, updateProfile, changePassword };
