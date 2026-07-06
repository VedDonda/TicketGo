/**
 * seatQueue.js — BullMQ Queue for async seat/inventory generation.
 *
 * Why a queue?
 *   Generating seats for a large event (e.g. 50 sections × 100 rows × 100 seats = 500,000 docs)
 *   synchronously on the HTTP request thread risks a timeout and blocks the event loop.
 *   BullMQ moves this work off the request thread entirely.
 *
 * Graceful degradation:
 *   getSeatQueue() returns null if Redis is unavailable. Callers fall back to
 *   the synchronous generateSeatsForEvent() path that already exists.
 *
 * Job payload: { eventId: string, targetStatus: 'PUBLISHED' | 'DRAFT' }
 */

const { Queue } = require('bullmq');
const { createRedisClient } = require('../config/redis');

let _seatQueue = null;

/**
 * Returns the singleton BullMQ seat-generation Queue, or null if Redis is unavailable.
 * @returns {import('bullmq').Queue | null}
 */
const getSeatQueue = () => {
  if (_seatQueue) return _seatQueue;

  // BullMQ Queue needs its own ioredis connection — don't reuse the shared client.
  const connection = createRedisClient();
  if (!connection) return null;

  _seatQueue = new Queue('seat-generation', {
    connection,
    defaultJobOptions: {
      attempts: 3,                                    // retry up to 3 times on failure
      backoff: { type: 'exponential', delay: 2000 }, // 2s → 4s → 8s
      removeOnComplete: { count: 100 },               // keep last 100 completed jobs for debug
      removeOnFail:     { count: 50  },               // keep last 50 failed jobs for debug
    },
  });

  _seatQueue.on('error', (err) => {
    console.error('[SeatQueue] Queue error:', err.message);
  });

  console.log('[SeatQueue] Seat-generation queue initialized');
  return _seatQueue;
};

module.exports = { getSeatQueue };
