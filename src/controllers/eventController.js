const Event = require('../models/Event');
const { generateSeatsForEvent } = require('../utils/seatGenerator');

// ─── POST /api/events ─────────────────────────────────────────────────────────

/**
 * @desc   Create a new event (ORGANIZER / ADMIN only)
 * @route  POST /api/events
 * @access Private — ORGANIZER | ADMIN
 *
 * Flow:
 *  1. Validate request body
 *  2. Save event as DRAFT
 *  3. Generate seats/inventory synchronously inline → event becomes PUBLISHED
 *  4. Optionally enqueue a BullMQ job if Redis is available (for large events / retries)
 *  5. Return 201 with the PUBLISHED event
 *
 * Why inline?  The worker process requires Redis to be running. Without it,
 * events would be stuck as DRAFT and never appear on the home page.
 * The synchronous path guarantees the event is always published immediately.
 */
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      venue,
      date,
      eventType,
      seatingConfig,
      zoningConfig,
      imageUrl,
    } = req.body;

    // ── Type-specific config validation ─────────────────────────────────────
    if (eventType === 'RESERVED_SEATING') {
      if (!seatingConfig || !Array.isArray(seatingConfig) || seatingConfig.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'seatingConfig array is required for RESERVED_SEATING events',
        });
      }
    } else if (eventType === 'ZONED_CAPACITY') {
      if (!zoningConfig || !Array.isArray(zoningConfig) || zoningConfig.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'zoningConfig array is required for ZONED_CAPACITY events',
        });
      }
    }

    // ── Save event as DRAFT ──────────────────────────────────────────────────
    const event = await Event.create({
      organizer: req.user._id,
      title,
      description,
      category,
      venue,
      date,
      eventType,
      seatingConfig: eventType === 'RESERVED_SEATING' ? seatingConfig : undefined,
      zoningConfig:  eventType === 'ZONED_CAPACITY'   ? zoningConfig  : undefined,
      imageUrl,
      status: 'DRAFT',
    });

    // ── Generate seats/inventory synchronously ───────────────────────────────
    // This always runs — ensures the event is PUBLISHED immediately after creation.
    const { insertedCount } = await generateSeatsForEvent(event._id);
    console.log(`[EventController] Event ${event._id} published — ${insertedCount} records inserted`);

    // ── Also try to enqueue a BullMQ job (bonus, non-blocking) ──────────────
    // If Redis is running, this allows the worker to verify/re-process.
    // If Redis is down, we silently skip — the event is already published above.
    try {
      const { seatGenerationQueue } = require('../queues/eventQueue');
      await seatGenerationQueue.add(
        'Create_Seats',
        { eventId: event._id.toString() },
        { jobId: `seats-${event._id}` }
      );
    } catch {
      // Redis unavailable — no problem, seats are already generated above
    }

    // ── Fetch the updated (PUBLISHED) event to return to the client ──────────
    const publishedEvent = await Event.findById(event._id).populate('organizer', 'name').lean();

    return res.status(201).json({
      success: true,
      message: `Event "${title}" is now live! ${insertedCount} ${
        eventType === 'RESERVED_SEATING' ? 'seat(s)' : 'zone(s)'
      } created.`,
      data: { event: publishedEvent },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    console.error('[EventController] createEvent error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating event' });
  }
};

// ─── GET /api/events ──────────────────────────────────────────────────────────

/**
 * @desc   Get all published upcoming events (public)
 * @route  GET /api/events
 * @access Public
 *
 * Query params:
 *   page     — page number (default: 1)
 *   limit    — items per page (default: 10, max: 50)
 *   category — filter by category (e.g. MUSIC, SPORTS)
 *   city     — filter by venue city (case-insensitive)
 *   search   — text search on title
 */
const getEvents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // ── Build filter ─────────────────────────────────────────────────────────
    const filter = {
      status: 'PUBLISHED',
      date: { $gte: new Date() }, // only upcoming events
    };

    if (req.query.category) {
      filter.category = req.query.category.toUpperCase();
    }

    if (req.query.city) {
      filter['venue.city'] = { $regex: req.query.city, $options: 'i' };
    }

    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: 'i' };
    }

    // ── Query with pagination ────────────────────────────────────────────────
    const [events, totalCount] = await Promise.all([
      Event.find(filter)
        .populate('organizer', 'name') // only expose organizer name, not email/password
        .sort({ date: 1 })             // earliest upcoming events first
        .skip(skip)
        .limit(limit)
        .lean(),                       // plain JS objects — faster for read-only responses
      Event.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('[EventController] getEvents error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching events' });
  }
};

// ─── GET /api/events/:id ──────────────────────────────────────────────────────

/**
 * @desc   Get a single event by ID (public)
 * @route  GET /api/events/:id
 * @access Public
 */
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name')
      .lean();

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Don't expose DRAFT or CANCELLED events to anonymous users
    if (event.status === 'DRAFT' || event.status === 'CANCELLED') {
      const isOwner =
        req.user && req.user._id.toString() === event.organizer._id.toString();
      const isAdmin = req.user && req.user.role === 'ADMIN';
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
    }

    return res.status(200).json({ success: true, data: { event } });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    console.error('[EventController] getEventById error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching event' });
  }
};

module.exports = { createEvent, getEvents, getEventById };
