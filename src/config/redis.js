// Redis configuration and connection
const IORedis = require("ioredis");
const REDIS_URL = process.env.REDIS_URL;

const createRedisClient = (overrides = {}) => {
  if (!REDIS_URL) {
    console.warn("[Redis] REDIS_URL not set — Redis features disabled");

    return null;
  }

  try {
    const isTLS = REDIS_URL.startsWith("rediss://");
    const client = new IORedis(REDIS_URL, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 5) return null;

        return Math.min(times * 200, 2000);
      },
      ...(isTLS ? { tls: {} } : {}),
      ...overrides,
    });

    client.on("error", (err) => {
      console.error(`[Redis] Client error: ${err.message}`);
    });

    return client;
  } catch (err) {
    console.error(`[Redis] Failed to initialize: ${err.message}`);

    return null;
  }
};

let _sharedClient = null;

const getRedisClient = () => {
  if (_sharedClient) return _sharedClient;
  const client = createRedisClient({ maxRetriesPerRequest: 3 });

  if (client) {
    client.on("connect", () => console.log("[Redis] Shared client connected"));
    client.on("ready", () => console.log("[Redis] Shared client ready"));
    _sharedClient = client;
  }

  return _sharedClient;
};

module.exports = { getRedisClient, createRedisClient, REDIS_URL };
