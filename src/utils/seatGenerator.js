/**
 * seatGenerator.js — Shared seat/inventory generation logic.
 *
 * Used by:
 *   - eventController.js  (inline / synchronous path when Redis is unavailable)
 *   - seatWorker.js       (async BullMQ path when Redis is available)
 *
 * Keeping it here avoids duplicating the logic in two places.
 */

const Event     = require('../models/Event');
const Ticket    = require('../models/Ticket');
const Inventory = require('../models/Inventory');

// ─── Row label helper ─────────────────────────────────────────────────────────
// 0→A, 1→B, …, 25→Z, 26→AA, 27→AB, …
const generateRowLabel = (index) => {
  let label = '';
  let i = index;
  do {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return label;
};

// ─── Document builders ────────────────────────────────────────────────────────

const buildSeatDocuments = (event) => {
  const seats = [];
  for (const config of event.seatingConfig) {
    for (let r = 0; r < config.rows; r++) {
      const rowLabel = generateRowLabel(r);
      for (let s = 1; s <= config.seatsPerRow; s++) {
        seats.push({
          event:      event._id,
          section:    config.section,
          row:        rowLabel,
          seatNumber: s,
          price:      config.price,
          status:     'AVAILABLE',
        });
      }
    }
  }
  return seats;
};

const buildInventoryDocuments = (event) =>
  event.zoningConfig.map((zone) => ({
    event:          event._id,
    zoneName:       zone.zoneName,
    totalSeats:     zone.totalSeats,
    availableSeats: zone.totalSeats,
    price:          zone.price,
  }));

// ─── Core generation function ─────────────────────────────────────────────────

/**
 * Generates seats or inventory for an event and marks it PUBLISHED.
 *
 * @param {string|ObjectId} eventId
 * @returns {{ insertedCount: number }}
 */
const generateSeatsForEvent = async (eventId, targetStatus = 'PUBLISHED') => {
  const event = await Event.findById(eventId);
  if (!event) throw new Error(`Event ${eventId} not found`);

  // Idempotency guard — safe to call twice
  if (event.status !== 'DRAFT') {
    return { insertedCount: 0, skipped: true, reason: `Already ${event.status}` };
  }

  let insertedCount = 0;

  if (event.eventType === 'RESERVED_SEATING') {
    const seats  = buildSeatDocuments(event);
    // ordered:false → duplicate-key errors are silently skipped (compound index protection)
    const result = await Ticket.insertMany(seats, { ordered: false });
    insertedCount = result.length;
  } else if (event.eventType === 'ZONED_CAPACITY') {
    const zones  = buildInventoryDocuments(event);
    const result = await Inventory.insertMany(zones, { ordered: false });
    insertedCount = result.length;
  }

  await Event.findByIdAndUpdate(eventId, { status: targetStatus });

  return { insertedCount };
};

module.exports = {
  generateSeatsForEvent,
  buildSeatDocuments,
  buildInventoryDocuments,
};
