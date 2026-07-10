const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const {
  generateOtp,
  storePendingSignup,
  getPendingSignup,
  deletePendingSignup,
  verifyOtp: verifyOtpInRedis,
  checkResendCooldown,
} = require('../utils/otpService');
const { sendOtpEmail } = require('../utils/brevoMailer');

// ── JWT helpers ───────────────────────────────────────────────────────────────

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id:    user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  });
};

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * @desc   Initiate signup — validate input, store pending data in Redis, send OTP.
 *         The MongoDB User document is NOT created yet. Registration is only
 *         completed after the OTP is verified via POST /api/auth/verify-otp.
 * @route  POST /api/auth/signup
 * @access Public
 */
const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Basic field validation
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    // Guard: email already registered in DB
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const allowedRoles = ['CUSTOMER', 'ORGANIZER'];
    const userRole = allowedRoles.includes(role) ? role : 'CUSTOMER';

    const otp = generateOtp();

    // Persist pending signup data + OTP in Redis (TTL: 10 min)
    // User is NOT saved to MongoDB at this point
    await storePendingSignup(email, { name, email, password, role: userRole }, otp);

    // Send OTP email via Brevo
    try {
      await sendOtpEmail(email, name, otp);
    } catch (mailErr) {
      // Clean up Redis so user can retry cleanly
      await deletePendingSignup(email);
      console.error('[Auth] Brevo email failed:', mailErr.message);
      return res.status(502).json({
        success: false,
        message: 'Failed to send verification email. Please check your email address and try again.',
        detail: process.env.NODE_ENV === 'development' ? mailErr.message : undefined,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'A 6-digit verification code has been sent to your email. It expires in 10 minutes.',
    });
  } catch (error) {
    console.error('[Auth] Signup error:', error);
    res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

/**
 * @desc   Verify the OTP and complete registration.
 *         On success, the User document is created in MongoDB and a JWT is issued.
 *         Organizers are created but must still await admin approval before login.
 * @route  POST /api/auth/verify-otp
 * @access Public
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const result = await verifyOtpInRedis(email, otp.toString().trim());

    // OTP expired (key gone from Redis)
    if (result.expired) {
      return res.status(410).json({
        success: false,
        message: 'Your verification code has expired. Please sign up again.',
      });
    }

    // Too many wrong attempts — pending data deleted, must restart
    if (result.tooManyAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Your session has been cleared — please sign up again.',
      });
    }

    // Wrong OTP but still has attempts left
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: `Incorrect verification code. ${result.attemptsLeft} attempt(s) remaining.`,
      });
    }

    // ── OTP correct — create the user ──────────────────────────────────────
    const { name, password, role } = result.data;

    // Race condition guard: check again before inserting
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const user = await User.create({
      name,
      email,
      password,                         // Mongoose pre-save hook hashes this
      role,
      isEmailVerified: true,            // ✅ verified
      isVerified: role !== 'ORGANIZER', // ORGANIZER still needs admin approval
    });

    // Organizer: email verified but awaiting admin
    if (role === 'ORGANIZER') {
      return res.status(201).json({
        success: true,
        message:
          'Email verified! Your organizer account is now pending admin approval. ' +
          'You will be notified once approved.',
      });
    }

    // Customer: issue JWT immediately
    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('[Auth] Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

/**
 * @desc   Resend a fresh OTP to the user's email.
 *         Subject to a 60-second per-email cooldown (otpService) AND the
 *         IP-level rate limiter applied in the router.
 * @route  POST /api/auth/resend-otp
 * @access Public
 */
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Enforce 60-second cooldown (per-email, stored in Redis)
    const cooldown = await checkResendCooldown(email);
    if (cooldown.onCooldown) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${cooldown.ttl} second(s) before requesting a new code.`,
      });
    }

    // Retrieve pending signup data
    const pending = await getPendingSignup(email);
    if (!pending) {
      return res.status(404).json({
        success: false,
        message: 'No pending registration found for this email. Please sign up again.',
      });
    }

    const { name, password, role } = pending;
    const otp = generateOtp();

    // Overwrite existing pending record (resets attempts to 0, refreshes TTL)
    await storePendingSignup(email, { name, email, password, role }, otp);
    await sendOtpEmail(email, name, otp);

    return res.status(200).json({
      success: true,
      message: 'A new verification code has been sent to your email.',
    });
  } catch (error) {
    console.error('[Auth] Resend OTP error:', error);
    res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

/**
 * @desc   Login.
 *         Guards: email must be verified AND (for ORGANIZER) admin must have approved.
 * @route  POST /api/auth/login
 * @access Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Fetch user with password field (select: false by default)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      // Generic message to prevent user enumeration
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Guard 1: Email must be verified
    // Note: `isEmailVerified === false` (not just falsy) so existing users
    // with `undefined` field (before this feature) are treated as verified.
    if (user.isEmailVerified === false) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
      });
    }

    // Guard 2: Organizer must be approved by admin
    if (user.role === 'ORGANIZER' && !user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your organizer account is pending admin approval.',
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

/**
 * @desc   Get current logged-in user profile.
 * @route  GET /api/auth/me
 * @access Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again later.' });
  }
};

module.exports = { signup, login, getMe, verifyOtp, resendOtp };
