/**
 * worker.js — Standalone BullMQ worker entry point
 *
 * Run separately from the API server:
 *   node worker.js
 *
 * This process ONLY handles background seat-generation jobs.
 * It connects to MongoDB (to write Ticket/Inventory documents)
 * and to Redis (to receive jobs from BullMQ).
 *
 * Why separate?
 *   - Crashing the worker doesn't take down the HTTP API
 *   - The worker can be scaled independently
 *   - No shared memory/state concerns
 */

require('dotenv').config();
const connectDB = require('./src/config/db');

const start = async () => {
  // Connect to MongoDB first — the worker writes to Ticket and Inventory collections
  await connectDB();

  // Importing seatWorker after DB is connected so Mongoose models are ready
  const seatWorker = require('./src/workers/seatWorker');

  console.log('🚀 TicketGo seat-generation worker started and listening for jobs...');

  // Graceful shutdown handlers
  const shutdown = async (signal) => {
    console.log(`\n[Worker] ${signal} received — closing worker gracefully...`);
    await seatWorker.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start().catch((err) => {
  console.error('[Worker] Fatal startup error:', err);
  process.exit(1);
});
