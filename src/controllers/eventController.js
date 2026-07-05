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
      hasImage: !!imageUrl && imageUrl.startsWith('data:image'),
      status: 'DRAFT', // Always start as DRAFT
    });

    const targetStatus = req.body.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';

    // ── Generate seats/inventory synchronously ───────────────────────────────
    // This always runs — ensures the event gets its seats built immediately.
    // The targetStatus determines if it stays DRAFT or goes live.
    const { insertedCount } = await generateSeatsForEvent(event._id, targetStatus);
    console.log(`[EventController] Event ${event._id} generated seats — Status: ${targetStatus}`);



    // ── Fetch the updated event to return to the client ──────────
    const updatedEvent = await Event.findById(event._id).populate('organizer', 'name').lean();

    return res.status(201).json({
      success: true,
      message: `Event "${title}" saved as ${targetStatus}! ${insertedCount} ${
        eventType === 'RESERVED_SEATING' ? 'seat(s)' : 'zone(s)'
      } created.`,
      data: { event: updatedEvent },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    console.error('[EventController] createEvent error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while creating the event. Please try again later.' });
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
      date: { $gte: new Date() },
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
        .populate('organizer', 'name')
        .select('-imageUrl -seatingConfig -zoningConfig')
        .sort({ date: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),                       // plain JS objects — faster for read-only responses
      Event.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        events: events.map(mapImageRoute),
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
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while fetching events. Please try again later.' });
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
      .select('-imageUrl')
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

    return res.status(200).json({ success: true, data: { event: mapImageRoute(event) } });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    console.error('[EventController] getEventById error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred while fetching the event. Please try again later.' });
  }
};

// ─── DELETE /api/events/:id ───────────────────────────────────────────────────

/**
 * @desc   Delete an event (ADMIN only)
 * @route  DELETE /api/events/:id
 * @access Private — ADMIN
 */
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Optional cleanup: delete associated inventory and tickets
    try {
      const Ticket = require('../models/Ticket');
      const Inventory = require('../models/Inventory');
      await Promise.all([
        Ticket.deleteMany({ event: event._id }),
        Inventory.deleteMany({ event: event._id })
      ]);
    } catch (e) {}

    await Event.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('[EventController] deleteEvent error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred... Please try again later.' });
  }
};

// ─── HELPER: Map Base64 Images ─────────────────────────────────────────────
// Prevents sending massive 5MB+ base64 strings in JSON responses.
// Since we exclude imageUrl from the query, we use hasImage to generate the path.
const mapImageRoute = (event) => {
  if (event && event.hasImage) {
    event.imageUrl = `/api/events/${event._id}/image`;
  } else if (event && event.imageUrl && event.imageUrl.startsWith('http')) {
    // Keep external URL if somehow provided
  } else if (event && event.imageUrl && event.imageUrl.startsWith('data:image')) {
    // If we fetched the full document (e.g. getEventById), strip it
    event.imageUrl = `/api/events/${event._id}/image`;
  }
  return event;
};

// ─── GET /api/events/:id/image ────────────────────────────────────────────────
/**
 * @desc   Serve the base64 image directly as a binary HTTP response
 * @route  GET /api/events/:id/image
 * @access Public
 */
const getEventImage = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select('imageUrl').lean();
    if (!event || !event.imageUrl || !event.imageUrl.startsWith('data:image')) {
      return res.status(404).send('Not found');
    }

    const matches = event.imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).send('Invalid image format');
    }

    const mimeType = matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=86400' // Cache for 1 day
    });
    res.end(imageBuffer);
  } catch (error) {
    console.error('[EventController] getEventImage error:', error);
    res.status(500).send('Server error');
  }
};

// ─── PUT /api/events/:id/image ────────────────────────────────────────────────

/**
 * @desc   Update event image (ORGANIZER / ADMIN only)
 * @route  PUT /api/events/:id/image
 * @access Private — ORGANIZER | ADMIN
 */
const updateEventImage = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    // Check ownership
    const isOwner = req.user._id.toString() === event.organizer.toString();
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this event' });
    }

    if (!req.body.imageUrl) {
      return res.status(400).json({ success: false, message: 'imageUrl is required' });
    }

    event.imageUrl = req.body.imageUrl;
    event.hasImage = !!req.body.imageUrl && req.body.imageUrl.startsWith('data:image');
    await event.save();

    return res.status(200).json({ success: true, message: 'Event image updated successfully', data: { event } });
  } catch (error) {
    console.error('[EventController] updateEventImage error:', error);
    return res.status(500).json({ success: false, message: 'An unexpected error occurred... Please try again later.' });
  }
};

// ─── GET /api/events/organizer/me ────────────────────────────────────────────────

/**
 * @desc   Get events created by the logged-in organizer
 * @route  GET /api/events/organizer/me
 * @access Private — ORGANIZER | ADMIN
 */
const getMyEvents = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user._id })
      .select('-imageUrl -seatingConfig -zoningConfig')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: { events: events.map(mapImageRoute) } });
  } catch (error) {
    console.error('[EventController] getMyEvents error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PUT /api/events/:id/publish ─────────────────────────────────────────────

/**
 * @desc   Publish a draft event
 * @route  PUT /api/events/:id/publish
 * @access Private — ORGANIZER (owner) | ADMIN
 */
const publishEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    
    // Auth check
    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to publish this event' });
    }

    if (event.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: `Event is already ${event.status}` });
    }

    const { insertedCount } = await generateSeatsForEvent(event._id, 'PUBLISHED');
    return res.status(200).json({ success: true, message: `Event published! ${insertedCount} records inserted.` });
  } catch (error) {
    console.error('[EventController] publishEvent error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/events/:id/dashboard-metrics ───────────────────────────────────

/**
 * @desc   Get basic ticket sales metrics for the Organizer Dashboard
 * @route  GET /api/events/:id/dashboard-metrics
 * @access Private — ORGANIZER (owner) | ADMIN
 */
const getDashboardMetrics = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    
    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    let ticketsSold = 0;
    let totalCapacity = 0;
    let totalRevenue = 0;

    if (event.eventType === 'RESERVED_SEATING') {
      const Ticket = require('../models/Ticket');
      const stats = await Ticket.aggregate([
        { $match: { event: event._id } },
        { 
          $group: {
            _id: null,
            totalCapacity: { $sum: 1 },
            ticketsSold: { $sum: { $cond: [{ $eq: ["$status", "BOOKED"] }, 1, 0] } },
            totalRevenue: { $sum: { $cond: [{ $eq: ["$status", "BOOKED"] }, "$price", 0] } }
          }
        }
      ]);
      
      if (stats.length > 0) {
        totalCapacity = stats[0].totalCapacity;
        ticketsSold = stats[0].ticketsSold;
        totalRevenue = stats[0].totalRevenue;
      }
    } else if (event.eventType === 'ZONED_CAPACITY') {
      const Inventory = require('../models/Inventory');
      const stats = await Inventory.aggregate([
        { $match: { event: event._id } },
        {
          $group: {
            _id: null,
            totalCapacity: { $sum: "$totalSeats" },
            ticketsSold: { $sum: { $subtract: ["$totalSeats", "$availableSeats"] } },
            totalRevenue: { 
              $sum: { 
                $multiply: [ { $subtract: ["$totalSeats", "$availableSeats"] }, "$price" ] 
              } 
            }
          }
        }
      ]);
      
      if (stats.length > 0) {
        totalCapacity = stats[0].totalCapacity;
        ticketsSold = stats[0].ticketsSold;
        totalRevenue = stats[0].totalRevenue;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        ticketsSold,
        ticketsRemaining: totalCapacity - ticketsSold,
        totalCapacity,
        totalRevenue,
      }
    });
  } catch (error) {
    console.error('[EventController] getDashboardMetrics error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createEvent, getEvents, getEventById, deleteEvent, getEventImage, updateEventImage, getMyEvents, publishEvent, getDashboardMetrics };
