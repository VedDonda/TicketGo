/**
 * rateLimiter.js — Redis-backed rate limiters for auth routes.
 *
 * Uses `express-rate-limit` (v7+) with `rate-limit-redis` store backed
 * by the shared ioredis client already configured in src/config/redis.js.
 *
 * Graceful degradation:
 *   If Redis is unavailable, the store falls back to express-rate-limit's
 *   built-in in-memory store automatically — the app stays running.
 *
 * Applied only on /api/auth/* routes (per user requirements).
 */

const rateLimit  = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');

// ── Redis Store factory ───────────────────────────────────────────────────────
// rate-limit-redis v4+ uses `sendCommand` — a thin adapter around ioredis.call()
// If getRedisClient() returns null (Redis down), store is undefined and
// express-rate-limit automatically falls back to its in-memory store.

const makeStore = (prefix) => {
  const redis = getRedisClient();
  if (!redis) {
    console.warn(`[RateLimiter] Redis unavailable — "${prefix}" limiter using in-memory store`);
    return undefined;
  }
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: `rl:${prefix}:`,
  });
};

// ── Auth limiters ─────────────────────────────────────────────────────────────

/**
 * Login limiter — 10 attempts per IP per 15 minutes.
 * Prevents brute-force credential attacks.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('login'),
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again in 15 minutes.',
  },
});

/**
 * Signup limiter — 5 attempts per IP per hour.
 * Prevents bulk account creation / email harvesting.
 */
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Increased to 50 for testing
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('signup'),
  message: {
    success: false,
    message: 'Too many signup requests from this IP. Please try again in an hour.',
  },
});

/**
 * OTP verify limiter — 10 attempts per IP per 15 minutes.
 * Acts as a secondary defence on top of the per-email attempt counter
 * managed by otpService.js.
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('otp-verify'),
  message: {
    success: false,
    message: 'Too many OTP verification attempts. Please try again in 15 minutes.',
  },
});

/**
 * Resend OTP limiter — 3 resend requests per IP per hour.
 * Works alongside the per-email 60-second cooldown in otpService.js.
 */
const resendOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: makeStore('otp-resend'),
  message: {
    success: false,
    message: 'Too many resend OTP requests from this IP. Please try again in an hour.',
  },
});

module.exports = { authLimiter, signupLimiter, otpLimiter, resendOtpLimiter };
