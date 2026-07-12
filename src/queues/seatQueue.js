// BullMQ queue for handling background seat creation
const { Queue } = require("bullmq");
const { createRedisClient } = require("../config/redis");
let _seatQueue = null;

const getSeatQueue = () => {
  if (_seatQueue) return _seatQueue;
  const connection = createRedisClient();

  if (!connection) return null;
  _seatQueue = new Queue("seat-generation", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
  _seatQueue.on("error", (err) => {
    console.error("[SeatQueue] Queue error:", err.message);
  });
  console.log("[SeatQueue] Initialized");

  return _seatQueue;
};

module.exports = { getSeatQueue };
