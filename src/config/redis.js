/**
 * redis.js — Shared ioredis client factory.
 *
 * Why ioredis?
 *   - BullMQ is built on top of ioredis internally.
 *   - ioredis natively parses `rediss://` (TLS) URLs — required for Upstash.
 *   - One dependency covers all three Redis features (locks, BullMQ, Socket.IO adapter).
 *
 * Graceful degradation:
 *   - If REDIS_URL is missing → returns null. All callers treat null as "Redis unavailable"
 *     and fall back to the existing MongoDB-only behavior.
 *   - Connection errors are logged but never crash the process.
 */

const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;

/**
 * Factory — creates a fresh ioredis client.
 * BullMQ requires separate client instances for Queue and Worker,
 * so we expose a factory rather than a pure singleton.
 *
 * @param {object} overrides — ioredis options to merge in
 * @returns {import('ioredis').Redis | null}
 */
const createRedisClient = (overrides = {}) => {
  if (!REDIS_URL) {
    console.warn('[Redis] REDIS_URL not set — Redis features disabled (graceful fallback active)');
    return null;
  }

  try {
    // ioredis auto-enables TLS when the URL starts with rediss://
    // The explicit tls:{} object is required for Upstash in some environments.
    const isTLS = REDIS_URL.startsWith('rediss://');

    const client = new IORedis(REDIS_URL, {
      enableReadyCheck: false,   // don't wait for LOADING state on startup
      maxRetriesPerRequest: null, // required by BullMQ workers
      retryStrategy: (times) => {
        if (times > 5) return null; // stop retrying after 5 attempts
        return Math.min(times * 200, 2000); // exponential back-off up to 2s
      },
      ...(isTLS ? { tls: {} } : {}),
      ...overrides,
    });

    client.on('error', (err) => {
      // Don't crash — just log. Callers check for null before using.
      console.error(`[Redis] Client error: ${err.message}`);
    });

    return client;
  } catch (err) {
    console.error(`[Redis] Failed to initialize client: ${err.message}`);
    return null;
  }
};

// ── Shared singleton for non-BullMQ use (seat locks, etc.) ───────────────────
// BullMQ Queue and Worker each need their own client — use createRedisClient()
// directly for those.
let _sharedClient = null;

const getRedisClient = () => {
  if (_sharedClient) return _sharedClient;

  const client = createRedisClient({
    maxRetriesPerRequest: 3, // non-BullMQ callers can have a retry limit
  });

  if (client) {
    client.on('connect', () => console.log('[Redis] Shared client connected'));
    client.on('ready',   () => console.log('[Redis] Shared client ready'));
    _sharedClient = client;
  }

  return _sharedClient; // may be null if REDIS_URL not set
};

module.exports = { getRedisClient, createRedisClient, REDIS_URL };
