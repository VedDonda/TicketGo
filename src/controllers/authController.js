const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  generateOtp,
  storePendingSignup,
  getPendingSignup,
  deletePendingSignup,
  verifyOtp: verifyOtpInRedis,
  checkResendCooldown,
} = require("../utils/otpService");
const { sendOtpEmail } = require("../utils/brevoMailer");
const { getRedisClient } = require("../config/redis");
const RESET_PREFIX = "reset:password:";
const RESET_TTL = 10 * 60;
// Generate JWT token for authentication
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
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

const signup = async (req, res) => {
  try {
    // Extract required fields from request body
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Name, email, and password are required",
        });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "Email already in use" });
    }

    // Validate user role and generate a unique OTP
    const allowedRoles = ["CUSTOMER", "ORGANIZER"];
    const userRole = allowedRoles.includes(role) ? role : "CUSTOMER";
    const otp = generateOtp();

    // Temporarily store signup data in Redis
    await storePendingSignup(
      email,
      { name, email, password, role: userRole },
      otp,
    );

    try {
      await sendOtpEmail(email, name, otp);
    } catch (mailErr) {
      await deletePendingSignup(email);
      console.error("[Auth] Brevo email failed:", mailErr.message);

      return res.status(502).json({
        success: false,
        message:
          "Failed to send verification email. Please check your email address and try again.",
        detail:
          process.env.NODE_ENV === "development" ? mailErr.message : undefined,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "A 6-digit verification code has been sent to your email. It expires in 10 minutes.",
    });
  } catch (error) {
    console.error("[Auth] Signup error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required" });
    }

    const result = await verifyOtpInRedis(email, otp.toString().trim());

    if (result.expired) {
      return res.status(410).json({
        success: false,
        message: "Your verification code has expired. Please sign up again.",
      });
    }

    if (result.tooManyAttempts) {
      return res.status(429).json({
        success: false,
        message:
          "Too many incorrect attempts. Your session has been cleared — please sign up again.",
      });
    }

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: `Incorrect verification code. ${result.attemptsLeft} attempt(s) remaining.`,
      });
    }

    const { name, password, role } = result.data;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "Email already in use" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      isEmailVerified: true,
      isVerified: role !== "ORGANIZER",
    });

    if (role === "ORGANIZER") {
      return res.status(201).json({
        success: true,
        message:
          "Email verified! Your organizer account is now pending admin approval. " +
          "You will be notified once approved.",
      });
    }

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error("[Auth] Verify OTP error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const cooldown = await checkResendCooldown(email);

    if (cooldown.onCooldown) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${cooldown.ttl} second(s) before requesting a new code.`,
      });
    }

    const pending = await getPendingSignup(email);

    if (!pending) {
      return res.status(404).json({
        success: false,
        message:
          "No pending registration found for this email. Please sign up again.",
      });
    }

    const { name, password, role } = pending;
    const otp = generateOtp();

    await storePendingSignup(email, { name, email, password, role }, otp);
    await sendOtpEmail(email, name, otp);

    return res.status(200).json({
      success: true,
      message: "A new verification code has been sent to your email.",
    });
  } catch (error) {
    console.error("[Auth] Resend OTP error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    if (user.isEmailVerified === false) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
      });
    }

    if (user.role === "ORGANIZER" && !user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Your organizer account is pending admin approval.",
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error("[Auth] Login error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({ success: true, user });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No account found with this email address.",
        });
    }

    const redis = getRedisClient();

    if (!redis)
      return res
        .status(503)
        .json({ success: false, message: "Service temporarily unavailable" });
    const cooldown = await checkResendCooldown(`reset:${email}`);

    if (cooldown.onCooldown) {
      return res
        .status(429)
        .json({
          success: false,
          message: `Please wait ${cooldown.ttl} second(s) before requesting a new code.`,
        });
    }

    const otp = generateOtp();

    await redis.setex(
      `${RESET_PREFIX}${email}`,
      RESET_TTL,
      JSON.stringify({ otp, attempts: 0 }),
    );

    try {
      await sendOtpEmail(email, user.name, otp);
    } catch (mailErr) {
      await redis.del(`${RESET_PREFIX}${email}`);

      return res
        .status(502)
        .json({
          success: false,
          message: "Failed to send email. Please try again.",
        });
    }

    return res
      .status(200)
      .json({
        success: true,
        message: "A 6-digit reset code has been sent to your email.",
      });
  } catch (error) {
    console.error("[Auth] forgotPassword error:", error);
    res
      .status(500)
      .json({ success: false, message: "An unexpected error occurred." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email, OTP, and new password are required",
        });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Password must be at least 6 characters",
        });
    }

    const redis = getRedisClient();

    if (!redis)
      return res
        .status(503)
        .json({ success: false, message: "Service temporarily unavailable" });
    const key = `${RESET_PREFIX}${email}`;
    const raw = await redis.get(key);

    if (!raw)
      return res
        .status(410)
        .json({
          success: false,
          message: "Reset code has expired. Please request a new one.",
        });
    const record = JSON.parse(raw);

    if (record.attempts >= 5) {
      await redis.del(key);

      return res
        .status(429)
        .json({
          success: false,
          message: "Too many attempts. Please request a new code.",
        });
    }

    if (record.otp !== otp.toString().trim()) {
      record.attempts += 1;
      const ttl = await redis.ttl(key);

      if (record.attempts >= 5) {
        await redis.del(key);

        return res
          .status(429)
          .json({
            success: false,
            message: "Too many incorrect attempts. Please request a new code.",
          });
      }

      await redis.setex(key, ttl > 0 ? ttl : RESET_TTL, JSON.stringify(record));

      return res
        .status(400)
        .json({
          success: false,
          message: `Incorrect code. ${5 - record.attempts} attempt(s) remaining.`,
        });
    }

    await redis.del(key);
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    user.password = newPassword;
    await user.save();

    return res
      .status(200)
      .json({
        success: true,
        message: "Password reset successfully. You can now sign in.",
      });
  } catch (error) {
    console.error("[Auth] resetPassword error:", error);
    res
      .status(500)
      .json({ success: false, message: "An unexpected error occurred." });
  }
};

module.exports = {
  signup,
  login,
  getMe,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
};
