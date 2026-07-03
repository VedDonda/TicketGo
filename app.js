const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes  = require('./src/routes/authRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const userRoutes  = require('./src/routes/userRoutes');

const app = express();

// Security & parsing middleware
app.use(helmet({ contentSecurityPolicy: false })); // allow inline styles for frontend
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth',   authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users',  userRoutes);

// 404 fallback for unknown API routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  // For all other paths, fall back to index.html
  res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

module.exports = app;
