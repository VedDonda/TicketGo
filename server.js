require('dotenv').config();
const http      = require('http');
const { Server } = require('socket.io');
const app       = require('./app');
const connectDB = require('./src/config/db');

// ── Redis: Socket.IO adapter + BullMQ worker ──────────────────────────────────
const { createRedisClient } = require('./src/config/redis');
const { startSeatWorker, stopSeatWorker } = require('./src/workers/seatWorker');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  // ── Create HTTP server so Socket.IO shares the same port ──────────────────
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:5000'],
      methods: ['GET', 'POST'],
    },
  });

  // ── Socket.IO Redis Adapter (optional — degrades to in-memory if Redis unavailable) ─
  //
  // Why two clients?  The adapter uses Redis pub/sub: one client publishes,
  // the other subscribes. A single client cannot do both simultaneously in
  // subscribe mode, so the adapter requires separate pub and sub instances.
  //
  // Why does this matter?  Without the adapter, Socket.IO rooms are in-memory
  // on one Node process. With multiple server instances behind a load balancer,
  // a hold on instance A emits seat:update — but clients on instance B never see it.
  // The adapter syncs room membership and broadcasts across all instances via Redis.
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const pubClient = createRedisClient();
    const subClient = createRedisClient();

    if (pubClient && subClient) {
      // Wait for both clients to be ready before attaching the adapter
      await Promise.all([
        new Promise((res) => pubClient.once('ready', res)),
        new Promise((res) => subClient.once('ready', res)),
      ]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[Socket.IO] Redis adapter attached — multi-instance broadcasts enabled');
    } else {
      console.warn('[Socket.IO] Redis unavailable — using in-memory adapter (single-instance only)');
    }
  } catch (err) {
    console.warn(`[Socket.IO] Redis adapter failed to load: ${err.message} — falling back to in-memory`);
  }

  // Make io accessible inside Express route handlers via req.app.get('io')
  app.set('io', io);

  // ── Socket.IO connection handler ──────────────────────────────────────────
  io.on('connection', (socket) => {
    // Client sends { eventId } to subscribe to seat/zone updates for that event
    socket.on('join:event', ({ eventId }) => {
      if (eventId) {
        socket.join(`event:${eventId}`);
      }
    });

    socket.on('leave:event', ({ eventId }) => {
      if (eventId) {
        socket.leave(`event:${eventId}`);
      }
    });

    socket.on('disconnect', () => {});
  });

  // ── BullMQ Seat-Generation Worker (in-process) ────────────────────────────
  //
  // Starts in the same Node process for simplicity.
  // In production, extract to a separate entry point:  node src/workers/seatWorker.js
  // and run it as an independent service/container so it can scale independently.
  startSeatWorker(io);

  const server = httpServer.listen(PORT, () => {
    console.log(`TicketGo server running on http://localhost:${PORT}`);
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout   = 66000;

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully`);
    await stopSeatWorker();
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
};

start();
