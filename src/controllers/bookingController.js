const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Inventory = require("../models/Inventory");
const ZonedHold = require("../models/ZonedHold");
const { getRedisClient } = require("../config/redis");
const HOLD_MINUTES = 10;
const HOLD_SECONDS = HOLD_MINUTES * 60;
const MAX_SEAT_SELECT = 20;
const SEAT_LOCK_PREFIX = "seat:lock";
const getIO = (req) => req.app.get("io");
const seatLockKey = (eventId, section, row, seatNumber) =>
  `${SEAT_LOCK_PREFIX}:${eventId}:${section}:${row}:${seatNumber}`;

// Attempt to acquire Redis lock for a specific seat
const acquireSeatLock = async (
  redis,
  eventId,
  section,
  row,
  seatNumber,
  userId,
  ttlSeconds,
) => {
  if (!redis) return true;

  try {
    const result = await redis.set(
      seatLockKey(eventId, section, row, seatNumber),
      userId.toString(),
      "EX",
      ttlSeconds,
      "NX",
    );

    return result === "OK";
  } catch (err) {
    console.error("[Redis] acquireSeatLock error:", err.message);

    return true;
  }
};

const releaseSeatLock = async (redis, eventId, section, row, seatNumber) => {
  if (!redis) return;

  try {
    await redis.del(seatLockKey(eventId, section, row, seatNumber));
  } catch (err) {
    console.error("[Redis] releaseSeatLock error:", err.message);
  }
};

const releaseSeatLocks = async (redis, eventId, seats) => {
  if (!redis || seats.length === 0) return;

  try {
    const keys = seats.map(({ section, row, seatNumber }) =>
      seatLockKey(eventId, section, row, seatNumber),
    );

    await redis.del(...keys);
  } catch (err) {
    console.error("[Redis] releaseSeatLocks error:", err.message);
  }
};

// Release expired tickets and their associated Redis locks
const releaseExpiredTickets = async (eventId, redis = null) => {
  const now = new Date();

  if (redis) {
    try {
      const expiredTickets = await Ticket.find(
        { event: eventId, status: "HELD", heldUntil: { $lt: now } },
        "section row seatNumber",
      ).lean();

      if (expiredTickets.length > 0) {
        await releaseSeatLocks(redis, eventId.toString(), expiredTickets);
      }
    } catch (err) {
      console.error(
        "[Redis] Error cleaning up lock keys for expired tickets:",
        err.message,
      );
    }
  }

  const result = await Ticket.updateMany(
    { event: eventId, status: "HELD", heldUntil: { $lt: now } },
    { $set: { status: "AVAILABLE", heldBy: null, heldUntil: null } },
  );

  return result.modifiedCount;
};

const releaseExpiredZoneHolds = async (eventId) => {
  const now = new Date();
  const expired = await ZonedHold.find({
    event: eventId,
    expiresAt: { $lt: now },
  });

  for (const hold of expired) {
    await Inventory.findOneAndUpdate(
      { event: eventId, zoneName: hold.zoneName },
      { $inc: { availableSeats: hold.quantity } },
    );
    await ZonedHold.findByIdAndDelete(hold._id);
  }
};

// Fetch all seats and group them by section and row
const getSeats = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();

    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    if (event.eventType !== "RESERVED_SEATING") {
      return res
        .status(400)
        .json({
          success: false,
          message: "This event uses zone-based seating",
        });
    }

    const redis = getRedisClient();

    await releaseExpiredTickets(req.params.id, redis);
    const tickets = await Ticket.find({ event: req.params.id })
      .select("section row seatNumber status heldBy price")
      .lean();
    const grouped = {};

    for (const t of tickets) {
      if (!grouped[t.section]) grouped[t.section] = {};
      if (!grouped[t.section][t.row]) grouped[t.section][t.row] = [];
      grouped[t.section][t.row].push({
        _id: t._id,
        section: t.section,
        row: t.row,
        seatNumber: t.seatNumber,
        status: t.status,
        price: t.price,
        isMyHold: t.heldBy?.toString() === req.user?._id?.toString(),
      });
    }

    for (const section of Object.keys(grouped)) {
      for (const row of Object.keys(grouped[section])) {
        grouped[section][row].sort((a, b) => a.seatNumber - b.seatNumber);
      }
    }

    return res.status(200).json({ success: true, data: { seats: grouped } });
  } catch (error) {
    console.error("[BookingController] getSeats error:", error);

    return res
      .status(500)
      .json({
        success: false,
        message:
          "An unexpected error occurred while fetching seats. Please try again later.",
      });
  }
};

const getZones = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();

    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    if (event.eventType !== "ZONED_CAPACITY") {
      return res
        .status(400)
        .json({ success: false, message: "This event uses reserved seating" });
    }

    await releaseExpiredZoneHolds(req.params.id);
    const inventory = await Inventory.find({ event: req.params.id }).lean();
    const myHold = req.user
      ? await ZonedHold.findOne({
        event: req.params.id,
        user: req.user._id,
        expiresAt: { $gte: new Date() },
      })
      : null;

    return res.status(200).json({
      success: true,
      data: { zones: inventory, myHold: myHold || null },
    });
  } catch (error) {
    console.error("[BookingController] getZones error:", error);

    return res
      .status(500)
      .json({
        success: false,
        message:
          "An unexpected error occurred while fetching zones. Please try again later.",
      });
  }
};

const holdSeats = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();

    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    if (event.status !== "PUBLISHED") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Event is not available for booking",
        });
    }

    const io = getIO(req);
    const room = `event:${req.params.id}`;
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

    if (event.eventType === "RESERVED_SEATING") {
      const { seats } = req.body;
      const redis = getRedisClient();
      // Check for and release any expired tickets to free up locks
      const freed = await releaseExpiredTickets(req.params.id, redis);

      if (freed > 0) {
        io?.to(room).emit("seat:released", { eventId: req.params.id });
      }

      if (!Array.isArray(seats) || seats.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "seats array is required" });
      }

      if (seats.length > MAX_SEAT_SELECT) {
        return res.status(400).json({
          success: false,
          message: `Cannot select more than ${MAX_SEAT_SELECT} seats at once`,
        });
      }

      if (redis) {
        const existingHeld = await Ticket.find(
          { event: req.params.id, heldBy: req.user._id, status: "HELD" },
          "section row seatNumber",
        ).lean();

        if (existingHeld.length > 0) {
          await releaseSeatLocks(redis, req.params.id, existingHeld);
        }
      }

      await Ticket.updateMany(
        { event: req.params.id, heldBy: req.user._id, status: "HELD" },
        { $set: { status: "AVAILABLE", heldBy: null, heldUntil: null } },
      );
      const heldTickets = [];
      const failedSeats = [];
      const redisLockedSeats = [];

      for (const s of seats) {
        // Attempt to atomically lock the seat in Redis
        const lockAcquired = await acquireSeatLock(
          redis,
          req.params.id,
          s.section,
          s.row,
          s.seatNumber,
          req.user._id,
          HOLD_SECONDS,
        );

        if (!lockAcquired) {
          failedSeats.push(s);
          continue;
        }

        redisLockedSeats.push(s);
        const ticket = await Ticket.findOneAndUpdate(
          {
            event: req.params.id,
            section: s.section,
            row: s.row,
            seatNumber: s.seatNumber,
            status: "AVAILABLE",
          },
          {
            $set: {
              status: "HELD",
              heldBy: req.user._id,
              heldUntil: expiresAt,
            },
          },
          { returnDocument: "after" },
        );

        if (ticket) {
          heldTickets.push(ticket);
        } else {
          await releaseSeatLock(
            redis,
            req.params.id,
            s.section,
            s.row,
            s.seatNumber,
          );
          redisLockedSeats.pop();
          failedSeats.push(s);
        }
      }

      if (failedSeats.length > 0) {
        const heldIds = heldTickets.map((t) => t._id);

        await Ticket.updateMany(
          { _id: { $in: heldIds } },
          { $set: { status: "AVAILABLE", heldBy: null, heldUntil: null } },
        );
        await releaseSeatLocks(redis, req.params.id, heldTickets);

        return res.status(409).json({
          success: false,
          message: "One or more seats are no longer available",
          failedSeats,
        });
      }

      io?.to(room).emit("seat:update", {
        eventId: req.params.id,
        updatedSeats: heldTickets.map((t) => ({
          _id: t._id,
          section: t.section,
          row: t.row,
          seatNumber: t.seatNumber,
          status: "HELD",
        })),
      });
      const totalPrice = heldTickets.reduce((sum, t) => sum + t.price, 0);

      return res.status(200).json({
        success: true,
        message: `${heldTickets.length} seat(s) held for ${HOLD_MINUTES} minutes`,
        data: {
          heldTickets: heldTickets.map((t) => ({
            _id: t._id,
            section: t.section,
            row: t.row,
            seatNumber: t.seatNumber,
            price: t.price,
          })),
          expiresAt,
          totalPrice,
        },
      });
    }

    if (event.eventType === "ZONED_CAPACITY") {
      let zonesPayload = req.body.zones;

      if (!zonesPayload && req.body.zoneName) {
        zonesPayload = [
          { zoneName: req.body.zoneName, quantity: req.body.quantity },
        ];
      }

      if (!Array.isArray(zonesPayload) || zonesPayload.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "zones array is required" });
      }

      const totalQty = zonesPayload.reduce((s, z) => s + (z.quantity || 0), 0);

      if (totalQty < 1) {
        return res
          .status(400)
          .json({
            success: false,
            message: "At least 1 ticket must be selected",
          });
      }

      if (totalQty > MAX_SEAT_SELECT) {
        return res.status(400).json({
          success: false,
          message: `Cannot reserve more than ${MAX_SEAT_SELECT} tickets in one transaction`,
        });
      }

      await releaseExpiredZoneHolds(req.params.id);
      const existingHolds = await ZonedHold.find({
        event: req.params.id,
        user: req.user._id,
      });

      for (const eh of existingHolds) {
        await Inventory.findOneAndUpdate(
          { event: req.params.id, zoneName: eh.zoneName },
          { $inc: { availableSeats: eh.quantity } },
        );
        await ZonedHold.findByIdAndDelete(eh._id);
      }

      const decremented = [];

      for (const { zoneName, quantity } of zonesPayload) {
        if (!zoneName || !quantity || quantity < 1) continue;
        const inv = await Inventory.findOneAndUpdate(
          {
            event: req.params.id,
            zoneName,
            availableSeats: { $gte: quantity },
          },
          { $inc: { availableSeats: -quantity } },
          { returnDocument: "after" },
        );

        if (!inv) {
          for (const d of decremented) {
            await Inventory.findOneAndUpdate(
              { event: req.params.id, zoneName: d.zoneName },
              { $inc: { availableSeats: d.quantity } },
            );
          }

          return res.status(409).json({
            success: false,
            message: `Not enough seats available in zone "${zoneName}"`,
          });
        }

        decremented.push({
          zoneName,
          quantity,
          price: inv.price,
          availableSeats: inv.availableSeats,
        });
      }

      const holds = [];

      for (const d of decremented) {
        const h = await ZonedHold.create({
          event: req.params.id,
          user: req.user._id,
          zoneName: d.zoneName,
          quantity: d.quantity,
          expiresAt,
        });

        holds.push(h);
        io?.to(room).emit("zone:update", {
          eventId: req.params.id,
          zoneName: d.zoneName,
          availableSeats: d.availableSeats,
        });
      }

      const totalPrice = decremented.reduce(
        (s, d) => s + d.price * d.quantity,
        0,
      );

      return res.status(200).json({
        success: true,
        message: `${totalQty} ticket(s) held for ${HOLD_MINUTES} minutes`,
        data: {
          holds: holds.map((h, i) => ({
            holdId: h._id,
            zoneName: h.zoneName,
            quantity: h.quantity,
            price: decremented[i].price,
            subtotal: decremented[i].price * h.quantity,
          })),
          totalPrice,
          expiresAt,
        },
      });
    }

    return res
      .status(400)
      .json({ success: false, message: "Unknown event type" });
  } catch (error) {
    console.error("[BookingController] holdSeats error:", error);

    return res
      .status(500)
      .json({
        success: false,
        message:
          "An unexpected error occurred while placing your hold. Please try again later.",
      });
  }
};

const releaseHold = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();

    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    const io = getIO(req);
    const room = `event:${req.params.id}`;

    if (event.eventType === "RESERVED_SEATING") {
      const redis = getRedisClient();

      if (redis) {
        const heldTickets = await Ticket.find(
          { event: req.params.id, heldBy: req.user._id, status: "HELD" },
          "section row seatNumber",
        ).lean();

        if (heldTickets.length > 0) {
          await releaseSeatLocks(redis, req.params.id, heldTickets);
        }
      }

      const released = await Ticket.updateMany(
        { event: req.params.id, heldBy: req.user._id, status: "HELD" },
        { $set: { status: "AVAILABLE", heldBy: null, heldUntil: null } },
      );

      io?.to(room).emit("seat:released", {
        eventId: req.params.id,
        userId: req.user._id.toString(),
      });

      return res.status(200).json({
        success: true,
        message: `${released.modifiedCount} seat(s) released`,
      });
    }

    if (event.eventType === "ZONED_CAPACITY") {
      const holds = await ZonedHold.find({
        event: req.params.id,
        user: req.user._id,
      });

      if (holds.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "No active holds found" });
      }

      let totalReleased = 0;

      for (const hold of holds) {
        const inventory = await Inventory.findOneAndUpdate(
          { event: req.params.id, zoneName: hold.zoneName },
          { $inc: { availableSeats: hold.quantity } },
          { returnDocument: "after" },
        );

        await ZonedHold.findByIdAndDelete(hold._id);
        totalReleased += hold.quantity;
        io?.to(room).emit("zone:update", {
          eventId: req.params.id,
          zoneName: hold.zoneName,
          availableSeats: inventory?.availableSeats ?? 0,
        });
      }

      return res.status(200).json({
        success: true,
        message: `${totalReleased} ticket(s) released`,
      });
    }

    return res
      .status(400)
      .json({ success: false, message: "Unknown event type" });
  } catch (error) {
    console.error("[BookingController] releaseHold error:", error);

    return res
      .status(500)
      .json({
        success: false,
        message:
          "An unexpected error occurred while releasing your hold. Please try again later.",
      });
  }
};

const confirmPurchase = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();

    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    const io = getIO(req);
    const room = `event:${req.params.id}`;

    if (event.eventType === "RESERVED_SEATING") {
      const now = new Date();
      const redis = getRedisClient();
      const heldTickets = redis
        ? await Ticket.find(
          {
            event: req.params.id,
            heldBy: req.user._id,
            status: "HELD",
            heldUntil: { $gte: now },
          },
          "section row seatNumber",
        ).lean()
        : [];
      const result = await Ticket.updateMany(
        {
          event: req.params.id,
          heldBy: req.user._id,
          status: "HELD",
          heldUntil: { $gte: now },
        },
        {
          $set: {
            status: "BOOKED",
            bookedBy: req.user._id,
            heldBy: null,
            heldUntil: null,
          },
        },
      );

      if (result.modifiedCount === 0) {
        return res.status(409).json({
          success: false,
          message: "Your hold has expired. Please select your seats again.",
        });
      }

      if (redis && heldTickets.length > 0) {
        await releaseSeatLocks(redis, req.params.id, heldTickets);
      }

      const booked = await Ticket.find({
        event: req.params.id,
        bookedBy: req.user._id,
        status: "BOOKED",
      }).lean();

      io?.to(room).emit("seat:update", {
        eventId: req.params.id,
        updatedSeats: booked.map((t) => ({
          _id: t._id,
          section: t.section,
          row: t.row,
          seatNumber: t.seatNumber,
          status: "BOOKED",
        })),
      });
      const totalPrice = booked.reduce((sum, t) => sum + t.price, 0);

      return res.status(200).json({
        success: true,
        message: "Purchase confirmed",
        data: {
          tickets: booked,
          totalPrice,
        },
      });
    }

    if (event.eventType === "ZONED_CAPACITY") {
      const now = new Date();
      const holds = await ZonedHold.find({
        event: req.params.id,
        user: req.user._id,
        expiresAt: { $gte: now },
      });

      if (holds.length === 0) {
        return res.status(409).json({
          success: false,
          message: "Your hold has expired. Please try again.",
        });
      }

      const BookedZone = require("../models/BookedZone");
      const confirmedZones = [];
      let totalPrice = 0;

      for (const hold of holds) {
        await ZonedHold.findByIdAndDelete(hold._id);
        const inventory = await Inventory.findOne({
          event: req.params.id,
          zoneName: hold.zoneName,
        }).lean();
        const subtotal = inventory ? inventory.price * hold.quantity : 0;

        totalPrice += subtotal;
        await BookedZone.create({
          event: req.params.id,
          bookedBy: req.user._id,
          zoneName: hold.zoneName,
          quantity: hold.quantity,
          price: inventory ? inventory.price : 0,
        });
        confirmedZones.push({
          zoneName: hold.zoneName,
          quantity: hold.quantity,
          subtotal,
        });
        io?.to(room).emit("zone:update", {
          eventId: req.params.id,
          zoneName: hold.zoneName,
          availableSeats: inventory?.availableSeats ?? 0,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Purchase confirmed",
        data: {
          zones: confirmedZones,
          totalPrice,
        },
      });
    }

    return res
      .status(400)
      .json({ success: false, message: "Unknown event type" });
  } catch (error) {
    console.error("[BookingController] confirmPurchase error:", error);

    return res
      .status(500)
      .json({
        success: false,
        message:
          "An unexpected error occurred while confirming your purchase. Please try again later.",
      });
  }
};

const getMyTickets = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();

    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });

    if (event.eventType === "RESERVED_SEATING") {
      const tickets = await Ticket.find({
        event: req.params.id,
        bookedBy: req.user._id,
        status: "BOOKED",
      }).lean();
      const totalPrice = tickets.reduce((s, t) => s + t.price, 0);

      return res.status(200).json({
        success: true,
        data: {
          type: "RESERVED_SEATING",
          tickets: tickets.map((t) => ({
            _id: t._id,
            section: t.section,
            row: t.row,
            seatNumber: t.seatNumber,
            price: t.price,
            bookedAt: t.updatedAt,
          })),
          totalPrice,
          hasBooking: tickets.length > 0,
        },
      });
    }

    if (event.eventType === "ZONED_CAPACITY") {
      const BookedZone = require("../models/BookedZone");
      const bookedZones = await BookedZone.find({
        event: req.params.id,
        bookedBy: req.user._id,
      }).lean();
      const tickets = bookedZones.map((bz) => ({
        _id: bz._id,
        isZone: true,
        section: bz.zoneName,
        quantity: bz.quantity,
        price: bz.price * bz.quantity,
        bookedAt: bz.createdAt,
      }));
      const totalPrice = bookedZones.reduce(
        (s, bz) => s + bz.price * bz.quantity,
        0,
      );

      return res.status(200).json({
        success: true,
        data: {
          type: "ZONED_CAPACITY",
          hasBooking: bookedZones.length > 0,
          tickets,
          totalPrice,
        },
      });
    }

    return res.status(200).json({ success: true, data: { hasBooking: false } });
  } catch (error) {
    console.error("[BookingController] getMyTickets error:", error);

    return res
      .status(500)
      .json({
        success: false,
        message:
          "An unexpected error occurred while fetching your tickets. Please try again later.",
      });
  }
};

module.exports = {
  getSeats,
  getZones,
  holdSeats,
  releaseHold,
  confirmPurchase,
  getMyTickets,
};
