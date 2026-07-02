const { Queue } = require('bullmq');
const { createRedisConnection } = require('../config/redis');

/**
 * The "seat-generation" queue.
 *
 * The event controller calls seatGenerationQueue.add() after saving a DRAFT event.
 * The worker process (worker.js) listens on the same queue name and processes jobs.
 *
 * Job payload shape:
 *   { eventId: string }
 */
const seatGenerationQueue = new Queue('seat-generation', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,           // retry up to 3 times on worker failure
    backoff: {
      type: 'exponential',
      delay: 2000,         // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 60 * 60 * 24,  // keep completed jobs for 24 hours for observability
      count: 500,
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 7, // keep failed jobs for 7 days for debugging
    },
  },
});

module.exports = { seatGenerationQueue };
