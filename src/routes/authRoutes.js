const express = require('express');
const router  = express.Router();

const { signup, login, getMe, verifyOtp, resendOtp } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, signupLimiter, otpLimiter, resendOtpLimiter } = require('../middleware/rateLimiter');

// ── Auth routes (rate-limited) ────────────────────────────────────────────────

// Step 1: Initiate signup → sends OTP, stores pending data in Redis (no DB write yet)
router.post('/signup', signupLimiter, signup);

// Step 2a: Verify OTP → creates user in DB, issues JWT (or pending message for organizer)
router.post('/verify-otp', otpLimiter, verifyOtp);

// Step 2b: Resend OTP (60s per-email cooldown + IP rate limit)
router.post('/resend-otp', resendOtpLimiter, resendOtp);

// Login (guards: isEmailVerified + organizer approval)
router.post('/login', authLimiter, login);

// Protected route
router.get('/me', protect, getMe);

module.exports = router;
