// Authentication routes for login and signup
const express = require("express");
const router = express.Router();

const {
  signup,
  login,
  getMe,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const {
  authLimiter,
  signupLimiter,
  otpLimiter,
  resendOtpLimiter,
} = require("../middleware/rateLimiter");

router.post("/signup", signupLimiter, signup);
router.post("/verify-otp", otpLimiter, verifyOtp);
router.post("/resend-otp", resendOtpLimiter, resendOtp);
router.post("/login", authLimiter, login);
router.post("/forgot-password", signupLimiter, forgotPassword);
router.post("/reset-password", otpLimiter, resetPassword);
router.get("/me", protect, getMe);

module.exports = router;
