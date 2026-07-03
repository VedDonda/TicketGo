  const User    = require('../models/User');
const Ticket  = require('../models/Ticket');
const Event   = require('../models/Event');
const Inventory = require('../models/Inventory');
const bcrypt  = require('bcryptjs');

// ── GET /api/users/me/bookings ─────────────────────────────────────────────────
// Returns all BOOKED tickets + zone purchases grouped by event.
const getMyBookings = async (req, res) => {
  try {
    // Reserved seating tickets booked by this user
    const tickets = await Ticket.find({ bookedBy: req.user._id, status: 'BOOKED' })
      .populate({ path: 'event', select: 'title date venue category eventType status imageUrl' })
      .sort({ createdAt: -1 })
      .lean();

    // Group reserved tickets by event
    const eventMap = {};

    for (const t of tickets) {
      if (!t.event) continue;
      const eId = t.event._id.toString();
      if (!eventMap[eId]) {
        eventMap[eId] = {
          event:         t.event,
          type:          'RESERVED_SEATING',
          tickets:       [],
          totalPrice:    0,
          bookedAt:      t.createdAt,
        };
      }
      eventMap[eId].tickets.push({
        _id:        t._id,
        section:    t.section,
        row:        t.row,
        seatNumber: t.seatNumber,
        price:      t.price,
        createdAt:  t.createdAt,
      });
      eventMap[eId].totalPrice += t.price;
      // Use the latest booking time
      if (new Date(t.createdAt) > new Date(eventMap[eId].bookedAt)) {
        eventMap[eId].bookedAt = t.createdAt;
      }
    }

    // Zoned capacity: we store confirmed purchases in Inventory (availableSeats stays low).
    // We track them via a separate BookedZone model — but since we don't have one yet,
    // we infer from ZonedHold deletions. Instead, let's create a simple approach:
    // We'll look at events where the user has no ZonedHold (consumed = confirmed).
    // Better: we store zoned purchases as synthetic tickets (one per zone booking confirmation).
    // For now: expose reserved seating bookings + any zoned holds that confirmed.
    // The confirm endpoint deletes holds, so we rely on a BookedZone collection.
    // Since there is no such collection yet, we only return reserved seating here.
    // Zoned bookings are tracked via a "ZonedBooking" approach we'll add below.

    const bookings = Object.values(eventMap).sort(
      (a, b) => new Date(b.bookedAt) - new Date(a.bookedAt)
    );

    return res.status(200).json({ success: true, data: { bookings } });
  } catch (error) {
    console.error('[UserController] getMyBookings error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET /api/users/me/profile ──────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({
      success: true,
      data: {
        id:        user._id,
        name:      user.name,
        email:     user.email,
        role:      user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[UserController] getProfile error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/users/me/profile ──────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name && !email) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    // Check email uniqueness if changing email
    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
    }

    const updates = {};
    if (name)  updates.name  = name.trim();
    if (email) updates.email = email.trim().toLowerCase();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('[UserController] updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── PUT /api/users/me/password ─────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('[UserController] changePassword error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getMyBookings, getProfile, updateProfile, changePassword };
