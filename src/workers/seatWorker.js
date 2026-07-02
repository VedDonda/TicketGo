const { Worker } = require('bullmq');
const { createRedisConnection } = require('../config/redis');
const { generateSeatsForEvent } = require('../utils/seatGenerator');

// ─── Worker ───────────────────────────────────────────────────────────────────

const seatWorker = new Worker(
  'seat-generation',
  async (job) => {
    const { eventId } = job.data;
    console.log(`[Worker] Processing job ${job.id} for event ${eventId}`);

    await job.updateProgress(10);

    // Delegate all logic to the shared utility (same code used inline by the controller)
    const result = await generateSeatsForEvent(eventId);

    await job.updateProgress(100);

    if (result.skipped) {
      console.log(`[Worker] Skipped event ${eventId}: ${result.reason}`);
    } else {
      console.log(`[Worker] ✅ Event ${eventId} — ${result.insertedCount} records inserted`);
    }

    return result;
  },
  {
    connection: createRedisConnection(),
    concurrency: 5,
  }
);

// ─── Worker Event Listeners ───────────────────────────────────────────────────

seatWorker.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completed:`, result);
});

seatWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed after all retries:`, err.message);
});

seatWorker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

module.exports = seatWorker;
