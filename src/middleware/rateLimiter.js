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

const customKeyGenerator = (req) => {
  const ip = req.ip;
  const userAgent = req.headers["user-agent"] || "unknown-agent";
  return `${ip}:${userAgent}`;
};

const LOAD_TEST_SECRET = process.env.LOAD_TEST_SECRET || null;

function withBypass(limiter) {
  return (req, res, next) => {
    const key = req.headers["x-load-test-key"];
    if (LOAD_TEST_SECRET && key === LOAD_TEST_SECRET) {
      return next();
    }
    return limiter(req, res, next);
  };
}

const authLimiter = withBypass(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  store: makeStore("login"),
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
}));

const signupLimiter = withBypass(rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  store: makeStore("signup"),
  message: {
    success: false,
    message: "Too many signup requests. Please try again in an hour.",
  },
}));

const otpLimiter = withBypass(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  store: makeStore("otp-verify"),
  message: {
    success: false,
    message: "Too many OTP attempts. Please try again in 15 minutes.",
  },
}));

const resendOtpLimiter = withBypass(rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: customKeyGenerator,
  store: makeStore("otp-resend"),
  message: {
    success: false,
    message: "Too many resend requests. Please try again in an hour.",
  },
}));

module.exports = { authLimiter, signupLimiter, otpLimiter, resendOtpLimiter };
