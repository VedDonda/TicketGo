const express = require('express');
const router = express.Router();
const { createEvent, getEvents, getEventById } = require('../controllers/eventController');
const {
  getSeats,
  getZones,
  holdSeats,
  releaseHold,
  confirmPurchase,
  getMyTickets,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/authMiddleware');

// ── Public routes ──────────────────────────────────────────────────────────────

// GET /api/events          → paginated public feed of published events
router.get('/', getEvents);

// GET /api/events/:id      → single event detail (public; DRAFT events hidden)
router.get('/:id', getEventById);

// ── Protected routes ───────────────────────────────────────────────────────────

// POST /api/events         → create a new event (ORGANIZER or ADMIN only)
router.post('/', protect, authorize('ORGANIZER', 'ADMIN'), createEvent);

// ── Booking routes (all require authentication) ────────────────────────────────

// GET  /api/events/:id/seats   → live seat map for RESERVED_SEATING events
router.get('/:id/seats', protect, getSeats);

// GET  /api/events/:id/zones   → live zone availability for ZONED_CAPACITY events
router.get('/:id/zones', protect, getZones);

// POST /api/events/:id/hold    → hold seat(s) or zone qty for 10 minutes
router.post('/:id/hold', protect, holdSeats);

// POST /api/events/:id/release → explicitly release a hold
router.post('/:id/release', protect, releaseHold);

// POST /api/events/:id/confirm → confirm purchase (stub — marks BOOKED permanently)
router.post('/:id/confirm', protect, confirmPurchase);

// GET  /api/events/:id/my-tickets → current user's booked tickets for this event
router.get('/:id/my-tickets', protect, getMyTickets);

module.exports = router;
