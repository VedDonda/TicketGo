/**
 * bookingController.js
 *
 * Handles all seat/zone booking interactions:
 *   GET  /api/events/:id/seats   → live seat map (with lazy-expiry of stale holds)
 *   GET  /api/events/:id/zones   → live zone availability (with lazy-expiry of stale holds)
 *   POST /api/events/:id/hold    → hold seat(s) or zone quantity for 10 minutes
 *   POST /api/events/:id/release → explicitly release a hold
 *   POST /api/events/:id/confirm → confirm purchase (stub — marks BOOKED / decrements pool)
 *
 * WebSocket: After any state mutation (hold / release / confirm), the handler
 * broadcasts a `seat:update` or `zone:update` event via Socket.IO so all
 * connected clients on the same event room refresh in real-time.
 */

const Event     = require('../models/Event');
const Ticket    = require('../models/Ticket');
const Inventory = require('../models/Inventory');
const ZonedHold = require('../models/ZonedHold');

const HOLD_MINUTES  = 10;
const MAX_SEAT_SELECT = 20;

// ─── Helper: get the Socket.IO instance attached to app ──────────────────────
const getIO = (req) => req.app.get('io');

// ─── Helper: lazy-expire stale HELD tickets ───────────────────────────────────
const releaseExpiredTickets = async (eventId) => {
  const now = new Date();
  await Ticket.updateMany(
    { event: eventId, status: 'HELD', heldUntil: { $lt: now } },
    { $set: { status: 'AVAILABLE', heldBy: null, heldUntil: null } }
  );
};

// ─── Helper: lazy-expire stale ZonedHolds and restore Inventory ───────────────
const releaseExpiredZoneHolds = async (eventId) => {
  const now = new Date();
  const expired = await ZonedHold.find({ event: eventId, expiresAt: { $lt: now } });
  for (const hold of expired) {
    await Inventory.findOneAndUpdate(
      { event: eventId, zoneName: hold.zoneName },
      { $inc: { availableSeats: hold.quantity } }
    );
    await ZonedHold.findByIdAndDelete(hold._id);
  }
};

// ─── GET /api/events/:id/seats ────────────────────────────────────────────────
/**
 * Returns all tickets for the event grouped by section → row → seat.
 * Performs lazy-expiry of stale HELD tickets first.
 */
const getSeats = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.eventType !== 'RESERVED_SEATING') {
      return res.status(400).json({ success: false, message: 'This event uses zone-based seating' });
    }

    // Lazy-expire stale holds
    await releaseExpiredTickets(req.params.id);

    const tickets = await Ticket.find({ event: req.params.id })
      .select('section row seatNumber status heldBy price')
      .lean();

    // Group: { [section]: { [row]: [ticket, …] } }
    const grouped = {};
    for (const t of tickets) {
      if (!grouped[t.section]) grouped[t.section] = {};
      if (!grouped[t.section][t.row]) grouped[t.section][t.row] = [];
      grouped[t.section][t.row].push({
        _id:        t._id,
        seatNumber: t.seatNumber,
        status:     t.status,
        price:      t.price,
        // Expose heldBy only to the holding user (so their selection is shown as SELECTED)
        isMyHold:   t.heldBy?.toString() === req.user?._id?.toString(),
      });
    }

    // Sort seats within each row by seatNumber
    for (const section of Object.keys(grouped)) {
      for (const row of Object.keys(grouped[section])) {
        grouped[section][row].sort((a, b) => a.seatNumber - b.seatNumber);
      }
    }

    return res.status(200).json({ success: true, data: { seats: grouped } });
  } catch (error) {
    console.error('[BookingController] getSeats error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching seats' });
  }
};

// ─── GET /api/events/:id/zones ────────────────────────────────────────────────
/**
 * Returns live zone availability for a ZONED_CAPACITY event.
 * Performs lazy-expiry of stale ZonedHolds first.
 */
const getZones = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.eventType !== 'ZONED_CAPACITY') {
      return res.status(400).json({ success: false, message: 'This event uses reserved seating' });
    }

    await releaseExpiredZoneHolds(req.params.id);

    const inventory = await Inventory.find({ event: req.params.id }).lean();

    // Also pull the caller's active hold (if any) for display
    const myHold = req.user
      ? await ZonedHold.findOne({ event: req.params.id, user: req.user._id, expiresAt: { $gte: new Date() } })
      : null;

    return res.status(200).json({
      success: true,
      data: { zones: inventory, myHold: myHold || null },
    });
  } catch (error) {
    console.error('[BookingController] getZones error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching zones' });
  }
};

// ─── POST /api/events/:id/hold ────────────────────────────────────────────────
/**
 * RESERVED_SEATING: body = { seats: [{ section, row, seatNumber }] }  (max 20)
 * ZONED_CAPACITY:   body = { zoneName, quantity }
 *
 * Atomically holds seats / decrements zone pool for 10 minutes.
 * Broadcasts `seat:update` or `zone:update` via Socket.IO.
 */
const holdSeats = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (event.status !== 'PUBLISHED') {
      return res.status(400).json({ success: false, message: 'Event is not available for booking' });
    }

    const io        = getIO(req);
    const room      = `event:${req.params.id}`;
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

    // ── RESERVED_SEATING path ─────────────────────────────────────────────────
    if (event.eventType === 'RESERVED_SEATING') {
      const { seats } = req.body;

      if (!Array.isArray(seats) || seats.length === 0) {
        return res.status(400).json({ success: false, message: 'seats array is required' });
      }
      if (seats.length > MAX_SEAT_SELECT) {
        return res.status(400).json({
          success: false,
          message: `Cannot select more than ${MAX_SEAT_SELECT} seats at once`,
        });
      }

      // Release any existing holds by this user on this event first (replace flow)
      await Ticket.updateMany(
        { event: req.params.id, heldBy: req.user._id, status: 'HELD' },
        { $set: { status: 'AVAILABLE', heldBy: null, heldUntil: null } }
      );

      // Atomically claim each requested seat (only if AVAILABLE)
      const heldTickets = [];
      const failedSeats = [];

      for (const s of seats) {
        const ticket = await Ticket.findOneAndUpdate(
          {
            event:      req.params.id,
            section:    s.section,
            row:        s.row,
            seatNumber: s.seatNumber,
            status:     'AVAILABLE',
          },
          {
            $set: {
              status:    'HELD',
              heldBy:    req.user._id,
              heldUntil: expiresAt,
            },
          },
          { returnDocument: 'after' }
        );

        if (ticket) heldTickets.push(ticket);
        else        failedSeats.push(s);
      }

      // If any seat wasn't available, roll back the ones we did hold
      if (failedSeats.length > 0) {
        const heldIds = heldTickets.map((t) => t._id);
        await Ticket.updateMany(
          { _id: { $in: heldIds } },
          { $set: { status: 'AVAILABLE', heldBy: null, heldUntil: null } }
        );
        return res.status(409).json({
          success: false,
          message: 'One or more seats are no longer available',
          failedSeats,
        });
      }

      // Broadcast updated seat states to all clients in this event room
      io?.to(room).emit('seat:update', {
        eventId: req.params.id,
        updatedSeats: heldTickets.map((t) => ({
          _id:        t._id,
          section:    t.section,
          row:        t.row,
          seatNumber: t.seatNumber,
          status:     'HELD',
        })),
      });

      const totalPrice = heldTickets.reduce((sum, t) => sum + t.price, 0);
      return res.status(200).json({
        success:    true,
        message:    `${heldTickets.length} seat(s) held for ${HOLD_MINUTES} minutes`,
        data: {
          heldTickets: heldTickets.map((t) => ({
            _id:        t._id,
            section:    t.section,
            row:        t.row,
            seatNumber: t.seatNumber,
            price:      t.price,
          })),
          expiresAt,
          totalPrice,
        },
      });
    }

    // ── ZONED_CAPACITY path ───────────────────────────────────────────────────
    if (event.eventType === 'ZONED_CAPACITY') {
      const { zoneName, quantity } = req.body;
      if (!zoneName || !quantity || quantity < 1) {
        return res.status(400).json({ success: false, message: 'zoneName and quantity are required' });
      }
      if (quantity > MAX_SEAT_SELECT) {
        return res.status(400).json({
          success: false,
          message: `Cannot reserve more than ${MAX_SEAT_SELECT} tickets at once`,
        });
      }

      await releaseExpiredZoneHolds(req.params.id);

      // Release existing hold by this user on this event (if any)
      const existingHold = await ZonedHold.findOneAndDelete({
        event: req.params.id,
        user:  req.user._id,
      });
      if (existingHold) {
        await Inventory.findOneAndUpdate(
          { event: req.params.id, zoneName: existingHold.zoneName },
          { $inc: { availableSeats: existingHold.quantity } }
        );
      }

      // Atomically decrement availableSeats — only succeeds if enough remain
      const inventory = await Inventory.findOneAndUpdate(
        {
          event:          req.params.id,
          zoneName,
          availableSeats: { $gte: quantity },
        },
        { $inc: { availableSeats: -quantity } },
        { returnDocument: 'after' }
      );

      if (!inventory) {
        return res.status(409).json({
          success: false,
          message: 'Not enough seats available in this zone',
        });
      }

      const hold = await ZonedHold.create({
        event:     req.params.id,
        user:      req.user._id,
        zoneName,
        quantity,
        expiresAt,
      });

      // Broadcast updated zone availability
      io?.to(room).emit('zone:update', {
        eventId:  req.params.id,
        zoneName,
        availableSeats: inventory.availableSeats,
      });

      return res.status(200).json({
        success: true,
        message: `${quantity} ticket(s) held in "${zoneName}" for ${HOLD_MINUTES} minutes`,
        data: {
          holdId:    hold._id,
          zoneName,
          quantity,
          price:     inventory.price,
          totalPrice: inventory.price * quantity,
          expiresAt,
        },
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown event type' });
  } catch (error) {
    console.error('[BookingController] holdSeats error:', error);
    return res.status(500).json({ success: false, message: 'Server error placing hold' });
  }
};

// ─── POST /api/events/:id/release ─────────────────────────────────────────────
/**
 * RESERVED_SEATING: body = { ticketIds: [id, …] }   — must be held by req.user
 * ZONED_CAPACITY:   body = { holdId }
 */
const releaseHold = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const io   = getIO(req);
    const room = `event:${req.params.id}`;

    if (event.eventType === 'RESERVED_SEATING') {
      const released = await Ticket.updateMany(
        { event: req.params.id, heldBy: req.user._id, status: 'HELD' },
        { $set: { status: 'AVAILABLE', heldBy: null, heldUntil: null } }
      );

      // Broadcast
      io?.to(room).emit('seat:released', { eventId: req.params.id, userId: req.user._id.toString() });

      return res.status(200).json({
        success: true,
        message: `${released.modifiedCount} seat(s) released`,
      });
    }

    if (event.eventType === 'ZONED_CAPACITY') {
      const { holdId } = req.body;
      const hold = await ZonedHold.findOne({
        _id:   holdId,
        event: req.params.id,
        user:  req.user._id,
      });

      if (!hold) {
        return res.status(404).json({ success: false, message: 'Hold not found or already expired' });
      }

      const inventory = await Inventory.findOneAndUpdate(
        { event: req.params.id, zoneName: hold.zoneName },
        { $inc: { availableSeats: hold.quantity } },
        { returnDocument: 'after' }
      );
      await ZonedHold.findByIdAndDelete(hold._id);

      io?.to(room).emit('zone:update', {
        eventId:        req.params.id,
        zoneName:       hold.zoneName,
        availableSeats: inventory.availableSeats,
      });

      return res.status(200).json({
        success: true,
        message: `${hold.quantity} ticket(s) released from "${hold.zoneName}"`,
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown event type' });
  } catch (error) {
    console.error('[BookingController] releaseHold error:', error);
    return res.status(500).json({ success: false, message: 'Server error releasing hold' });
  }
};

// ─── POST /api/events/:id/confirm ─────────────────────────────────────────────
/**
 * Stub payment confirmation — marks held seats/zones as permanently BOOKED.
 *
 * RESERVED_SEATING: Marks all HELD tickets by req.user as BOOKED.
 * ZONED_CAPACITY:   Deletes the ZonedHold (inventory already decremented on hold).
 *                   The seats are now "sold" — availableSeats stays low permanently.
 */
const confirmPurchase = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const io   = getIO(req);
    const room = `event:${req.params.id}`;

    if (event.eventType === 'RESERVED_SEATING') {
      const now = new Date();
      const result = await Ticket.updateMany(
        {
          event:     req.params.id,
          heldBy:    req.user._id,
          status:    'HELD',
          heldUntil: { $gte: now }, // must not be expired
        },
        {
          $set: {
            status:    'BOOKED',
            bookedBy:  req.user._id,
            heldBy:    null,
            heldUntil: null,
          },
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(409).json({
          success: false,
          message: 'Your hold has expired. Please select your seats again.',
        });
      }

      // Fetch confirmed tickets to return + broadcast
      const booked = await Ticket.find({
        event:    req.params.id,
        bookedBy: req.user._id,
        status:   'BOOKED',
      }).lean();

      io?.to(room).emit('seat:update', {
        eventId:      req.params.id,
        updatedSeats: booked.map((t) => ({
          _id:        t._id,
          section:    t.section,
          row:        t.row,
          seatNumber: t.seatNumber,
          status:     'BOOKED',
        })),
      });

      const totalPrice = booked.reduce((sum, t) => sum + t.price, 0);
      return res.status(200).json({
        success: true,
        message: '🎉 Purchase confirmed!',
        data: {
          tickets: booked,
          totalPrice,
        },
      });
    }

    if (event.eventType === 'ZONED_CAPACITY') {
      const { holdId } = req.body;
      const hold = await ZonedHold.findOne({
        _id:       holdId,
        event:     req.params.id,
        user:      req.user._id,
        expiresAt: { $gte: new Date() },
      });

      if (!hold) {
        return res.status(409).json({
          success: false,
          message: 'Your hold has expired. Please try again.',
        });
      }

      // Delete hold — inventory stays decremented (permanently sold)
      await ZonedHold.findByIdAndDelete(hold._id);

      const inventory = await Inventory.findOne({
        event:    req.params.id,
        zoneName: hold.zoneName,
      }).lean();

      io?.to(room).emit('zone:update', {
        eventId:        req.params.id,
        zoneName:       hold.zoneName,
        availableSeats: inventory?.availableSeats ?? 0,
      });

      return res.status(200).json({
        success: true,
        message: '🎉 Purchase confirmed!',
        data: {
          zoneName:   hold.zoneName,
          quantity:   hold.quantity,
          totalPrice: inventory ? inventory.price * hold.quantity : 0,
        },
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown event type' });
  } catch (error) {
    console.error('[BookingController] confirmPurchase error:', error);
    return res.status(500).json({ success: false, message: 'Server error confirming purchase' });
  }
};

module.exports = { getSeats, getZones, holdSeats, releaseHold, confirmPurchase };
