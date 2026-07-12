// Background worker for seat generation tasks
const { Worker } = require("bullmq");
const { generateSeatsForEvent } = require("../utils/seatGenerator");
const { createRedisClient } = require("../config/redis");
let _worker = null;

const startSeatWorker = (io = null) => {
  if (_worker) return _worker;
  const connection = createRedisClient();

  if (!connection) {
    console.warn(
      "[SeatWorker] Redis unavailable — using sync seat generation fallback.",
    );

    return null;
  }

  _worker = new Worker(
    "seat-generation",
    async (job) => {
      const { eventId, targetStatus = "PUBLISHED" } = job.data;

      console.log(`[SeatWorker] Processing job ${job.id} — event ${eventId}`);
      const result = await generateSeatsForEvent(eventId, targetStatus);

      console.log(
        `[SeatWorker] Job ${job.id} done — ${result.insertedCount} records, status → ${targetStatus}`,
      );

      if (io && !result.skipped) {
        io.emit("event:published", {
          eventId: eventId.toString(),
          status: targetStatus,
        });
      }

      return result;
    },
    { connection, concurrency: 5 },
  );
  _worker.on("completed", (job, result) => {
    if (result?.skipped) {
      console.log(`[SeatWorker] Job ${job.id} skipped — ${result.reason}`);
    }
  });
  _worker.on("failed", (job, err) => {
    console.error(`[SeatWorker] Job ${job?.id} failed: ${err.message}`);
  });
  _worker.on("error", (err) => {
    console.error(`[SeatWorker] Worker error: ${err.message}`);
  });
  console.log("[SeatWorker] Started (concurrency: 5)");

  return _worker;
};

const stopSeatWorker = async () => {
  if (_worker) {
    await _worker.close();
    console.log("[SeatWorker] Worker stopped");
    _worker = null;
  }
};

module.exports = { startSeatWorker, stopSeatWorker };
