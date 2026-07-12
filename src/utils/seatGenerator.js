const Event = require("../models/Event");
// Utility for bulk generating seats
const Ticket = require("../models/Ticket");
const Inventory = require("../models/Inventory");

const generateRowLabel = (index) => {
  let label = "";
  let i = index;

  do {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);

  return label;
};

const buildSeatDocuments = (event) => {
  const seats = [];
  const now = new Date();

  for (const config of event.seatingConfig) {
    for (let r = 0; r < config.rows; r++) {
      const rowLabel = generateRowLabel(r);

      for (let s = 1; s <= config.seatsPerRow; s++) {
        seats.push({
          event: event._id,
          section: config.section,
          row: rowLabel,
          seatNumber: s,
          price: config.price,
          status: "AVAILABLE",
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  return seats;
};

const buildInventoryDocuments = (event) => {
  const now = new Date();

  return event.zoningConfig.map((zone) => ({
    event: event._id,
    zoneName: zone.zoneName,
    totalSeats: zone.totalSeats,
    availableSeats: zone.totalSeats,
    price: zone.price,
    createdAt: now,
    updatedAt: now,
  }));
};

const generateSeatsForEvent = async (eventId, targetStatus = "PUBLISHED") => {
  const event = await Event.findById(eventId);

  if (!event) throw new Error(`Event ${eventId} not found`);

  if (event.status !== "DRAFT") {
    return {
      insertedCount: 0,
      skipped: true,
      reason: `Already ${event.status}`,
    };
  }

  let insertedCount = 0;

  if (event.eventType === "RESERVED_SEATING") {
    const seats = buildSeatDocuments(event);

    if (seats.length > 0) {
      const CHUNK_SIZE = 5000;

      for (let i = 0; i < seats.length; i += CHUNK_SIZE) {
        const chunk = seats.slice(i, i + CHUNK_SIZE);

        try {
          const result = await Ticket.collection.insertMany(chunk, {
            ordered: false,
          });

          insertedCount += result.insertedCount || 0;
        } catch (err) {
          if (err.name === "MongoBulkWriteError" && err.code === 11000) {
            insertedCount += err.insertedCount || 0;
          } else {
            throw err;
          }
        }
      }
    }
  } else if (event.eventType === "ZONED_CAPACITY") {
    const zones = buildInventoryDocuments(event);

    if (zones.length > 0) {
      try {
        const result = await Inventory.collection.insertMany(zones, {
          ordered: false,
        });

        insertedCount = result.insertedCount || 0;
      } catch (err) {
        if (err.name === "MongoBulkWriteError" && err.code === 11000) {
          insertedCount = err.insertedCount || 0;
        } else {
          throw err;
        }
      }
    }
  }

  await Event.findByIdAndUpdate(eventId, { status: targetStatus });

  return { insertedCount };
};

module.exports = {
  generateSeatsForEvent,
  buildSeatDocuments,
  buildInventoryDocuments,
};
