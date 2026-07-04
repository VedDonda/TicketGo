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
  const result = await Ticket.updateMany(
    { event: eventId, status: 'HELD', heldUntil: { $lt: now } },
    { $set: { status: 'AVAILABLE', heldBy: null, heldUntil: null } }
  );
  return result.modifiedCount; // how many were freed
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
        section:    t.section,   // needed by client to construct the hold payload
        row:        t.row,       // needed by client to construct the hold payload
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
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while fetching seats. Please try again later.' });
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
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while fetching zones. Please try again later.' });
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

      // Release any stale holds before attempting to claim seats —
      // prevents false 409s from expired-but-not-yet-cleaned-up HELD tickets
      const freed = await releaseExpiredTickets(req.params.id);
      if (freed > 0) {
        // Notify all clients in the room so their seat maps refresh automatically
        io?.to(room).emit('seat:released', { eventId: req.params.id });
      }

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
      // Accept either multi-zone array or legacy single-zone body
      let zonesPayload = req.body.zones;
      if (!zonesPayload && req.body.zoneName) {
        zonesPayload = [{ zoneName: req.body.zoneName, quantity: req.body.quantity }];
      }
      if (!Array.isArray(zonesPayload) || zonesPayload.length === 0) {
        return res.status(400).json({ success: false, message: 'zones array is required' });
      }

      const totalQty = zonesPayload.reduce((s, z) => s + (z.quantity || 0), 0);
      if (totalQty < 1) {
        return res.status(400).json({ success: false, message: 'At least 1 ticket must be selected' });
      }
      if (totalQty > MAX_SEAT_SELECT) {
        return res.status(400).json({
          success: false,
          message: `Cannot reserve more than ${MAX_SEAT_SELECT} tickets in one transaction`,
        });
      }

      await releaseExpiredZoneHolds(req.params.id);

      // Release all existing holds by this user on this event
      const existingHolds = await ZonedHold.find({ event: req.params.id, user: req.user._id });
      for (const eh of existingHolds) {
        await Inventory.findOneAndUpdate(
          { event: req.params.id, zoneName: eh.zoneName },
          { $inc: { availableSeats: eh.quantity } }
        );
        await ZonedHold.findByIdAndDelete(eh._id);
      }

      // Atomically decrement each zone — roll back if any fail
      const decremented = [];
      for (const { zoneName, quantity } of zonesPayload) {
        if (!zoneName || !quantity || quantity < 1) continue;
        const inv = await Inventory.findOneAndUpdate(
          { event: req.params.id, zoneName, availableSeats: { $gte: quantity } },
          { $inc: { availableSeats: -quantity } },
          { returnDocument: 'after' }
        );
        if (!inv) {
          // Roll back already decremented zones
          for (const d of decremented) {
            await Inventory.findOneAndUpdate(
              { event: req.params.id, zoneName: d.zoneName },
              { $inc: { availableSeats: d.quantity } }
            );
          }
          return res.status(409).json({
            success: false,
            message: `Not enough seats available in zone "${zoneName}"`,
          });
        }
        decremented.push({ zoneName, quantity, price: inv.price, availableSeats: inv.availableSeats });
      }

      // Create one hold doc per zone
      const holds = [];
      for (const d of decremented) {
        const h = await ZonedHold.create({
          event:     req.params.id,
          user:      req.user._id,
          zoneName:  d.zoneName,
          quantity:  d.quantity,
          expiresAt,
        });
        holds.push(h);
        io?.to(room).emit('zone:update', {
          eventId:        req.params.id,
          zoneName:       d.zoneName,
          availableSeats: d.availableSeats,
        });
      }

      const totalPrice = decremented.reduce((s, d) => s + d.price * d.quantity, 0);

      return res.status(200).json({
        success: true,
        message: `${totalQty} ticket(s) held for ${HOLD_MINUTES} minutes`,
        data: {
          holds: holds.map((h, i) => ({
            holdId:    h._id,
            zoneName:  h.zoneName,
            quantity:  h.quantity,
            price:     decremented[i].price,
            subtotal:  decremented[i].price * h.quantity,
          })),
          totalPrice,
          expiresAt,
        },
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown event type' });
  } catch (error) {
    console.error('[BookingController] holdSeats error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while placing your hold. Please try again later.' });
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
      // Release all holds for this user on this event (multi-zone support)
      const holds = await ZonedHold.find({ event: req.params.id, user: req.user._id });
      if (holds.length === 0) {
        return res.status(404).json({ success: false, message: 'No active holds found' });
      }
      let totalReleased = 0;
      for (const hold of holds) {
        const inventory = await Inventory.findOneAndUpdate(
          { event: req.params.id, zoneName: hold.zoneName },
          { $inc: { availableSeats: hold.quantity } },
          { returnDocument: 'after' }
        );
        await ZonedHold.findByIdAndDelete(hold._id);
        totalReleased += hold.quantity;
        io?.to(room).emit('zone:update', {
          eventId:        req.params.id,
          zoneName:       hold.zoneName,
          availableSeats: inventory?.availableSeats ?? 0,
        });
      }
      return res.status(200).json({
        success: true,
        message: `${totalReleased} ticket(s) released`,
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown event type' });
  } catch (error) {
    console.error('[BookingController] releaseHold error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while releasing your hold. Please try again later.' });
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
        message: 'Purchase confirmed',
        data: {
          tickets: booked,
          totalPrice,
        },
      });
    }

    if (event.eventType === 'ZONED_CAPACITY') {
      // Confirm all active (non-expired) holds for this user on this event
      const now = new Date();
      const holds = await ZonedHold.find({
        event:     req.params.id,
        user:      req.user._id,
        expiresAt: { $gte: now },
      });

      if (holds.length === 0) {
        return res.status(409).json({
          success: false,
          message: 'Your hold has expired. Please try again.',
        });
      }

      const confirmedZones = [];
      let totalPrice = 0;
      for (const hold of holds) {
        await ZonedHold.findByIdAndDelete(hold._id);
        const inventory = await Inventory.findOne({ event: req.params.id, zoneName: hold.zoneName }).lean();
        const subtotal = inventory ? inventory.price * hold.quantity : 0;
        totalPrice += subtotal;
        confirmedZones.push({
          zoneName:  hold.zoneName,
          quantity:  hold.quantity,
          subtotal,
        });
        io?.to(room).emit('zone:update', {
          eventId:        req.params.id,
          zoneName:       hold.zoneName,
          availableSeats: inventory?.availableSeats ?? 0,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Purchase confirmed',
        data: {
          zones:      confirmedZones,
          totalPrice,
        },
      });
    }

    return res.status(400).json({ success: false, message: 'Unknown event type' });
  } catch (error) {
    console.error('[BookingController] confirmPurchase error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while confirming your purchase. Please try again later.' });
  }
};

// ── GET /api/events/:id/my-tickets ──────────────────────────────────────────────
// Returns the current user's BOOKED tickets for this event (reserved + zoned metadata).
const getMyTickets = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (event.eventType === 'RESERVED_SEATING') {
      const tickets = await Ticket.find({
        event:    req.params.id,
        bookedBy: req.user._id,
        status:   'BOOKED',
      }).lean();

      const totalPrice = tickets.reduce((s, t) => s + t.price, 0);
      return res.status(200).json({
        success: true,
        data: {
          type:       'RESERVED_SEATING',
          tickets:    tickets.map((t) => ({
            _id:        t._id,
            section:    t.section,
            row:        t.row,
            seatNumber: t.seatNumber,
            price:      t.price,
            bookedAt:   t.updatedAt,
          })),
          totalPrice,
          hasBooking: tickets.length > 0,
        },
      });
    }

    if (event.eventType === 'ZONED_CAPACITY') {
      // Zoned purchases don't leave a permanent record in our schema yet.
      // We return hasBooking: false so the UI degrades gracefully.
      return res.status(200).json({
        success: true,
        data: { type: 'ZONED_CAPACITY', hasBooking: false, tickets: [], totalPrice: 0 },
      });
    }

    return res.status(200).json({ success: true, data: { hasBooking: false } });
  } catch (error) {
    console.error('[BookingController] getMyTickets error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while fetching your tickets. Please try again later.' });
  }
};

module.exports = { getSeats, getZones, holdSeats, releaseHold, confirmPurchase, getMyTickets };
