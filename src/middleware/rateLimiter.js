// API rate limiting configuration
const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { getRedisClient } = require("../config/redis");

const makeStore = (prefix) => {
  const redis = getRedisClient();

  if (!redis) return undefined;

  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: `rl:${prefix}:`,
  });
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: makeStore("login"),
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: makeStore("signup"),
  message: {
    success: false,
    message: "Too many signup requests. Please try again in an hour.",
  },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: makeStore("otp-verify"),
  message: {
    success: false,
    message: "Too many OTP attempts. Please try again in 15 minutes.",
  },
});

const resendOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: makeStore("otp-resend"),
  message: {
    success: false,
    message: "Too many resend requests. Please try again in an hour.",
  },
});

module.exports = { authLimiter, signupLimiter, otpLimiter, resendOtpLimiter };
