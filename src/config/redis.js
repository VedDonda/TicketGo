const Redis = require('ioredis');

/**
 * Shared ioredis connection factory.
 *
 * Supports two connection modes:
 *   1. REDIS_URL  — for Upstash / Redis Cloud (e.g. rediss://...)
 *                   Set this in .env and it takes priority.
 *   2. REDIS_HOST + REDIS_PORT — for a locally running Redis server.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on its ioredis connections
 * to prevent the client from giving up on blocked commands (like BRPOP).
 */
const createRedisConnection = () => {
  // Cloud Redis via URL (Upstash, Redis Cloud, etc.)
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,    // Required by BullMQ
      tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    });
  }

  // Local Redis (default for dev with Redis installed)
  return new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,    // Required by BullMQ
  });
};

module.exports = { createRedisConnection };
