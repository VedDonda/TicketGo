const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes  = require('./src/routes/authRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const userRoutes  = require('./src/routes/userRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');

const app = express();

// Security & parsing middleware
app.use(helmet({ contentSecurityPolicy: false })); // allow inline styles for frontend
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: false }));

// Serve static frontend and uploads
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth',   authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users',  userRoutes);
app.use('/api/upload', uploadRoutes);

// 404 fallback for unknown API routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }
  // For all other paths, fall back to index.html
  res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

module.exports = app;
