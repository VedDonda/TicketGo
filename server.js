// Server entry point and socket initialization
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./src/config/db");
const { createRedisClient } = require("./src/config/redis");
const { startSeatWorker, stopSeatWorker } = require("./src/workers/seatWorker");
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (process.env.ALLOWED_ORIGIN || "http://localhost:3000")
        .split(",")
        .map((o) => o.trim()),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  try {
    const { createAdapter } = require("@socket.io/redis-adapter");
    const pubClient = createRedisClient();
    const subClient = createRedisClient();

    if (pubClient && subClient) {
      await Promise.all([
        new Promise((res) => pubClient.once("ready", res)),
        new Promise((res) => subClient.once("ready", res)),
      ]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log("[Socket.IO] Redis adapter attached");
    } else {
      console.warn("[Socket.IO] Redis unavailable — using in-memory adapter");
    }
  } catch (err) {
    console.warn(
      `[Socket.IO] Redis adapter failed: ${err.message} — falling back to in-memory`,
    );
  }

  app.set("io", io);
  io.on("connection", (socket) => {
    socket.on("join:event", ({ eventId }) => {
      if (eventId) socket.join(`event:${eventId}`);
    });
    socket.on("leave:event", ({ eventId }) => {
      if (eventId) socket.leave(`event:${eventId}`);
    });
    socket.on("disconnect", () => {});
  });
  startSeatWorker(io);
  const server = httpServer.listen(PORT, () => {
    console.log(`TicketGo server running on http://localhost:${PORT}`);
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  const shutdown = async (signal) => {
    console.log(`\n[Server] ${signal} received — shutting down`);
    await stopSeatWorker();
    server.close(() => {
      console.log("[Server] HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start();
