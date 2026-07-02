require('dotenv').config();
const http      = require('http');
const { Server } = require('socket.io');
const app       = require('./app');
const connectDB = require('./src/config/db');

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

  httpServer.listen(PORT, () => {
    console.log(`TicketGo server running on http://localhost:${PORT}`);
  });
};

start();

