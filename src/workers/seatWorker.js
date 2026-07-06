/**
 * seatWorker.js — BullMQ Worker for the 'seat-generation' queue.
 *
 * Processes jobs enqueued by eventController when an organizer creates or publishes an event.
 * Calls the shared generateSeatsForEvent() utility — same logic as the sync path.
 *
 * After seats are generated, emits a Socket.IO `event:published` notification so the
 * organizer's dashboard updates without requiring a manual refresh.
 *
 * Concurrency: 5 — up to 5 events can be generated in parallel within this process.
 * In production, you'd scale by running this file as a separate worker process:
 *   node src/workers/seatWorker.js
 *
 * Graceful degradation:
 *   startSeatWorker() returns null if Redis is unavailable. The sync fallback in
 *   eventController.js handles seat generation in that case.
 */

const { Worker } = require('bullmq');
const { generateSeatsForEvent } = require('../utils/seatGenerator');
const { createRedisClient } = require('../config/redis');

let _worker = null;

/**
 * Starts the BullMQ worker and attaches it to the 'seat-generation' queue.
 *
 * @param {import('socket.io').Server | null} io — Socket.IO server instance for notifications
 * @returns {import('bullmq').Worker | null}
 */
const startSeatWorker = (io = null) => {
  if (_worker) return _worker; // already started

  // Worker needs its own dedicated ioredis connection
  const connection = createRedisClient();
  if (!connection) {
    console.warn('[SeatWorker] Redis unavailable — async worker not started. Falling back to sync seat generation.');
    return null;
  }

  _worker = new Worker(
    'seat-generation',
    async (job) => {
      const { eventId, targetStatus = 'PUBLISHED' } = job.data;
      console.log(`[SeatWorker] Processing job ${job.id} — event ${eventId}, target: ${targetStatus}`);

      const result = await generateSeatsForEvent(eventId, targetStatus);

      console.log(
        `[SeatWorker] Job ${job.id} complete — event ${eventId}: ${result.insertedCount} records inserted, status → ${targetStatus}`
      );

      // Notify the organizer's dashboard in real-time via Socket.IO
      if (io && !result.skipped) {
        // The organizer joins a room 'organizer:{userId}' on their dashboard.
        // We broadcast to the general 'organizer-updates' room here.
        // Clients can listen and re-fetch their event list.
        io.emit('event:published', { eventId: eventId.toString(), status: targetStatus });
        console.log(`[SeatWorker] Emitted event:published for ${eventId}`);
      }

      return result;
    },
    {
      connection,
      concurrency: 5, // process up to 5 events simultaneously in this worker process
    }
  );

  _worker.on('completed', (job, result) => {
    if (result?.skipped) {
      console.log(`[SeatWorker] Job ${job.id} skipped — event already ${result.reason}`);
    }
  });

  _worker.on('failed', (job, err) => {
    console.error(`[SeatWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`);
  });

  _worker.on('error', (err) => {
    console.error(`[SeatWorker] Worker error: ${err.message}`);
  });

  console.log('[SeatWorker] Seat-generation worker started (concurrency: 5)');
  return _worker;
};

/**
 * Gracefully shuts down the worker.
 * Call this on SIGTERM/SIGINT for clean process exit.
 */
const stopSeatWorker = async () => {
  if (_worker) {
    await _worker.close();
    console.log('[SeatWorker] Worker stopped');
    _worker = null;
  }
};

module.exports = { startSeatWorker, stopSeatWorker };
