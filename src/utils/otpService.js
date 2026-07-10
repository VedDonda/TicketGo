/**
 * otpService.js — OTP lifecycle management via Redis.
 *
 * Design:
 *   - Pending signup data (name, email, password, role) is stored in Redis
 *     under key `pending:signup:{email}` with a 10-minute TTL.
 *   - The MongoDB User document is NOT created until the OTP is verified.
 *   - Attempts are tracked inside the same Redis key to avoid a separate
 *     counter key. After MAX_ATTEMPTS wrong guesses the pending data is
 *     deleted and the user must restart signup.
 *   - A 60-second resend cooldown is stored under `otp:cooldown:{email}`.
 */

const crypto = require('crypto');
const { getRedisClient } = require('../config/redis');

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_TTL_SECONDS    = 10 * 60; // 10 minutes
const MAX_ATTEMPTS       = 5;
const RESEND_COOLDOWN_S  = 60;       // 60 seconds

const PENDING_PREFIX  = 'pending:signup:';
const COOLDOWN_PREFIX = 'otp:cooldown:';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure 6-digit OTP string.
 * Uses crypto.randomInt so output is uniformly distributed.
 */
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

// ── Pending signup storage ────────────────────────────────────────────────────

/**
 * Store pending signup data + OTP in Redis.
 * Overwrites any existing entry for this email (e.g. on resend).
 *
 * @param {string} email
 * @param {{ name, email, password, role }} signupData  — plain password; hashed by Mongoose pre-save
 * @param {string} otp
 */
const storePendingSignup = async (email, signupData, otp) => {
  const redis = getRedisClient();
  if (!redis) throw new Error('Redis unavailable — cannot process signup');

  const payload = JSON.stringify({ ...signupData, otp, attempts: 0 });
  await redis.setex(`${PENDING_PREFIX}${email}`, OTP_TTL_SECONDS, payload);
};

/**
 * Retrieve the raw pending signup record (without consuming it).
 * Returns null if expired or not found.
 *
 * @param {string} email
 * @returns {object|null}
 */
const getPendingSignup = async (email) => {
  const redis = getRedisClient();
  if (!redis) throw new Error('Redis unavailable');

  const raw = await redis.get(`${PENDING_PREFIX}${email}`);
  return raw ? JSON.parse(raw) : null;
};

/**
 * Delete the pending signup record (called after successful registration
 * or to force a fresh signup attempt).
 *
 * @param {string} email
 */
const deletePendingSignup = async (email) => {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.del(`${PENDING_PREFIX}${email}`);
};

// ── OTP verification ──────────────────────────────────────────────────────────

/**
 * Verify the OTP submitted by the user.
 *
 * Returns one of:
 *   { valid: true,  data: { name, email, password, role } }
 *   { valid: false, expired: true }
 *   { valid: false, tooManyAttempts: true }
 *   { valid: false, attemptsLeft: number }
 *
 * @param {string} email
 * @param {string} otp
 */
const verifyOtp = async (email, otp) => {
  const redis = getRedisClient();
  if (!redis) throw new Error('Redis unavailable');

  const key = `${PENDING_PREFIX}${email}`;
  const raw = await redis.get(key);

  // Key missing → expired or never existed
  if (!raw) return { valid: false, expired: true };

  const record = JSON.parse(raw);

  // Already maxed out (shouldn't reach here normally, but defensive)
  if (record.attempts >= MAX_ATTEMPTS) {
    await redis.del(key);
    return { valid: false, tooManyAttempts: true };
  }

  if (record.otp !== otp.toString()) {
    // Increment attempts and persist (preserve remaining TTL)
    record.attempts += 1;
    const remainingTtl = await redis.ttl(key);
    const ttlToUse = remainingTtl > 0 ? remainingTtl : OTP_TTL_SECONDS;

    if (record.attempts >= MAX_ATTEMPTS) {
      // Hit the limit on this attempt — delete immediately
      await redis.del(key);
      return { valid: false, tooManyAttempts: true };
    }

    await redis.setex(key, ttlToUse, JSON.stringify(record));
    return { valid: false, attemptsLeft: MAX_ATTEMPTS - record.attempts };
  }

  // ✅ Correct OTP — extract signup data and delete the pending record
  const { name, password, role } = record;
  await redis.del(key);

  return { valid: true, data: { name, email, password, role } };
};

// ── Resend cooldown ───────────────────────────────────────────────────────────

/**
 * Check (and enforce) the resend cooldown for an email.
 * If not on cooldown, sets the cooldown key so the next check blocks for 60s.
 *
 * Returns:
 *   { onCooldown: false }          — caller may proceed
 *   { onCooldown: true, ttl: N }  — N seconds remaining
 *
 * @param {string} email
 */
const checkResendCooldown = async (email) => {
  const redis = getRedisClient();
  if (!redis) throw new Error('Redis unavailable');

  const key = `${COOLDOWN_PREFIX}${email}`;
  const ttl = await redis.ttl(key);

  if (ttl > 0) return { onCooldown: true, ttl };

  await redis.setex(key, RESEND_COOLDOWN_S, '1');
  return { onCooldown: false };
};

module.exports = {
  generateOtp,
  storePendingSignup,
  getPendingSignup,
  deletePendingSignup,
  verifyOtp,
  checkResendCooldown,
};
