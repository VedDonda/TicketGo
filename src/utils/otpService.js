const crypto = require("crypto");
// Service for handling OTP generation and validation
const { getRedisClient } = require("../config/redis");
const OTP_TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_S = 60;
const PENDING_PREFIX = "pending:signup:";
const COOLDOWN_PREFIX = "otp:cooldown:";
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const storePendingSignup = async (email, signupData, otp) => {
  const redis = getRedisClient();

  if (!redis) throw new Error("Redis unavailable — cannot process signup");
  const payload = JSON.stringify({ ...signupData, otp, attempts: 0 });

  await redis.setex(`${PENDING_PREFIX}${email}`, OTP_TTL_SECONDS, payload);
};

const getPendingSignup = async (email) => {
  const redis = getRedisClient();

  if (!redis) throw new Error("Redis unavailable");
  const raw = await redis.get(`${PENDING_PREFIX}${email}`);

  return raw ? JSON.parse(raw) : null;
};

const deletePendingSignup = async (email) => {
  const redis = getRedisClient();

  if (!redis) return;
  await redis.del(`${PENDING_PREFIX}${email}`);
};

const verifyOtp = async (email, otp) => {
  const redis = getRedisClient();

  if (!redis) throw new Error("Redis unavailable");
  const key = `${PENDING_PREFIX}${email}`;
  const raw = await redis.get(key);

  if (!raw) return { valid: false, expired: true };
  const record = JSON.parse(raw);

  if (record.attempts >= MAX_ATTEMPTS) {
    await redis.del(key);

    return { valid: false, tooManyAttempts: true };
  }

  if (record.otp !== otp.toString()) {
    record.attempts += 1;
    const remainingTtl = await redis.ttl(key);
    const ttlToUse = remainingTtl > 0 ? remainingTtl : OTP_TTL_SECONDS;

    if (record.attempts >= MAX_ATTEMPTS) {
      await redis.del(key);

      return { valid: false, tooManyAttempts: true };
    }

    await redis.setex(key, ttlToUse, JSON.stringify(record));

    return { valid: false, attemptsLeft: MAX_ATTEMPTS - record.attempts };
  }

  const { name, password, role } = record;

  await redis.del(key);

  return { valid: true, data: { name, email, password, role } };
};

const checkResendCooldown = async (email) => {
  const redis = getRedisClient();

  if (!redis) throw new Error("Redis unavailable");
  const key = `${COOLDOWN_PREFIX}${email}`;
  const ttl = await redis.ttl(key);

  if (ttl > 0) return { onCooldown: true, ttl };
  await redis.setex(key, RESEND_COOLDOWN_S, "1");

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
