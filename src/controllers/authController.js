const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper: sign a JWT token
const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Helper: send token in response
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    // Only allow CUSTOMER or ORGANIZER on signup (not ADMIN)
    const allowedRoles = ['CUSTOMER', 'ORGANIZER'];
    const userRole = allowedRoles.includes(role) ? role : 'CUSTOMER';

    const user = await User.create({ name, email, password, role: userRole, isVerified: userRole !== 'ORGANIZER' });

    if (userRole === 'ORGANIZER') {
      return res.status(201).json({
        success: true,
        pending: true,
        message: 'Registration successful. Your organizer account is pending admin approval. You will be able to log in once approved.',
      });
    }

    sendTokenResponse(user, 201, res);
  } catch (error) {
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

// @desc    Login a user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Fetch user with password field (select: false by default)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.role === 'ORGANIZER' && !user.isVerified) {
      return res.status(403).json({ success: false, message: 'Your organizer account is pending admin approval.' });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

module.exports = { signup, login, getMe };
