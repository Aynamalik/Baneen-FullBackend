import { generateOTP } from '../utils/helpers.js';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

// In-memory fallback when Redis is not available
const otpStore = new Map();
const resetTokenStore = new Map();
const registrationStore = new Map();
const verificationTokenStore = new Map();

const OTP_EXPIRY_SEC = 10 * 60; // 10 minutes
const RESET_TOKEN_EXPIRY_SEC = 30 * 60; // 30 minutes
const REGISTRATION_EXPIRY_SEC = 15 * 60; // 15 minutes
const VERIFICATION_TOKEN_EXPIRY_SEC = 10 * 60; // 10 minutes

const OTP_EXPIRY_MS = OTP_EXPIRY_SEC * 1000;
const RESET_TOKEN_EXPIRY_MS = RESET_TOKEN_EXPIRY_SEC * 1000;
const REGISTRATION_EXPIRY_MS = REGISTRATION_EXPIRY_SEC * 1000;
const VERIFICATION_TOKEN_EXPIRY_MS = VERIFICATION_TOKEN_EXPIRY_SEC * 1000;

const PREFIX = { otp: 'otp:', reset: 'reset:', registration: 'registration:', verification: 'verification:' };

const useRedis = () => !!getRedisClient();

// --- Redis helpers ---
const redisSet = async (key, value, ttlSec) => {
  const redis = getRedisClient();
  if (!redis) return false;
  const json = JSON.stringify(value);
  if (ttlSec) {
    await redis.setex(key, ttlSec, json);
  } else {
    await redis.set(key, json);
  }
  return true;
};

const redisGet = async (key) => {
  const redis = getRedisClient();
  if (!redis) return null;
  const json = await redis.get(key);
  return json ? JSON.parse(json) : null;
};

const redisDel = async (key) => {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.del(key);
};

// --- OTP ---
export const generateAndStoreOTP = async (phone) => {
  const otp = generateOTP(6);
  const expiry = Date.now() + OTP_EXPIRY_MS;

  if (useRedis()) {
    const key = PREFIX.otp + phone;
    await redisSet(key, { otp, expiry, attempts: 0 }, OTP_EXPIRY_SEC);
    await redisSet(key + ':attempts', '0', OTP_EXPIRY_SEC);
  } else {
    otpStore.set(phone, { otp, expiry, attempts: 0 });
    cleanupExpiredOTPs();
  }

  logger.info(`OTP for ${phone}: ${otp}`);
  return otp;
};

/**
 * Overwrites the stored OTP for a phone (e.g. when Twilio fails for unverified numbers).
 * Use bypass OTP "123456" so user can still verify during testing.
 */
export const overwriteStoredOtp = async (phone, otp) => {
  if (useRedis()) {
    const key = PREFIX.otp + phone;
    const stored = await redisGet(key);
    if (!stored) return false;
    await redisSet(key, { ...stored, otp, attempts: 0 }, OTP_EXPIRY_SEC);
    await redisSet(key + ':attempts', '0', OTP_EXPIRY_SEC);
    logger.info(`OTP overwritten for ${phone} (bypass): ${otp}`);
    return true;
  }
  const stored = otpStore.get(phone);
  if (!stored) return false;
  stored.otp = otp;
  stored.attempts = 0;
  logger.info(`OTP overwritten for ${phone} (bypass): ${otp}`);
  return true;
};

export const verifyOTP = async (phone, otp) => {
  if (useRedis()) {
    const key = PREFIX.otp + phone;
    const stored = await redisGet(key);
    if (!stored) return false;
    if (Date.now() > stored.expiry) {
      await redisDel(key);
      await redisDel(key + ':attempts');
      return false;
    }
    const attemptsKey = key + ':attempts';
    const attempts = parseInt(await getRedisClient().get(attemptsKey) || '0', 10);
    if (attempts >= 5) {
      await redisDel(key);
      await redisDel(attemptsKey);
      return false;
    }
    if (stored.otp !== otp) {
      await getRedisClient().incr(attemptsKey);
      return false;
    }
    await redisDel(key);
    await redisDel(attemptsKey);
    return true;
  }

  const stored = otpStore.get(phone);
  if (!stored) return false;
  if (Date.now() > stored.expiry) {
    otpStore.delete(phone);
    return false;
  }
  if (stored.attempts >= 5) {
    otpStore.delete(phone);
    return false;
  }
  if (stored.otp !== otp) {
    stored.attempts += 1;
    return false;
  }
  otpStore.delete(phone);
  return true;
};

// --- Verification token ---
export const generateVerificationToken = async (phone) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + VERIFICATION_TOKEN_EXPIRY_MS;

  if (useRedis()) {
    await redisSet(PREFIX.verification + token, { phone, expiry }, VERIFICATION_TOKEN_EXPIRY_SEC);
  } else {
    verificationTokenStore.set(token, { phone, expiry });
    cleanupExpiredVerificationTokens();
  }
  return token;
};

export const getPhoneFromVerificationToken = async (token) => {
  if (useRedis()) {
    const stored = await redisGet(PREFIX.verification + token);
    if (!stored) return null;
    if (Date.now() > stored.expiry) {
      await redisDel(PREFIX.verification + token);
      return null;
    }
    return stored.phone;
  }

  const stored = verificationTokenStore.get(token);
  if (!stored) return null;
  if (Date.now() > stored.expiry) {
    verificationTokenStore.delete(token);
    return null;
  }
  return stored.phone;
};

export const removeVerificationToken = async (token) => {
  if (useRedis()) {
    await redisDel(PREFIX.verification + token);
  } else {
    verificationTokenStore.delete(token);
  }
};

// --- Cleanup (in-memory only; Redis uses TTL) ---
const cleanupExpiredVerificationTokens = () => {
  const now = Date.now();
  for (const [t, data] of verificationTokenStore.entries()) {
    if (now > data.expiry) verificationTokenStore.delete(t);
  }
};

const cleanupExpiredOTPs = () => {
  const now = Date.now();
  for (const [phone, data] of otpStore.entries()) {
    if (now > data.expiry) otpStore.delete(phone);
  }
};

export const getOTPExpiry = async (phone) => {
  if (useRedis()) {
    const stored = await redisGet(PREFIX.otp + phone);
    if (!stored) return 0;
    return Math.max(0, stored.expiry - Date.now());
  }
  const stored = otpStore.get(phone);
  if (!stored) return 0;
  return Math.max(0, stored.expiry - Date.now());
};

// --- Reset token ---
export const generateResetToken = async (phone) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + RESET_TOKEN_EXPIRY_MS;

  if (useRedis()) {
    await redisSet(PREFIX.reset + token, { phone, expiry }, RESET_TOKEN_EXPIRY_SEC);
  } else {
    resetTokenStore.set(token, { phone, expiry });
    cleanupExpiredResetTokens();
  }
  return token;
};

export const verifyResetToken = async (token) => {
  if (useRedis()) {
    const stored = await redisGet(PREFIX.reset + token);
    if (!stored) return null;
    if (Date.now() > stored.expiry) {
      await redisDel(PREFIX.reset + token);
      return null;
    }
    return stored.phone;
  }

  const stored = resetTokenStore.get(token);
  if (!stored) return null;
  if (Date.now() > stored.expiry) {
    resetTokenStore.delete(token);
    return null;
  }
  return stored.phone;
};

const cleanupExpiredResetTokens = () => {
  const now = Date.now();
  for (const [t, data] of resetTokenStore.entries()) {
    if (now > data.expiry) resetTokenStore.delete(t);
  }
};

// --- Registration data ---
export const storeRegistrationData = async (phone, registrationData) => {
  const expiry = Date.now() + REGISTRATION_EXPIRY_MS;

  if (useRedis()) {
    await redisSet(PREFIX.registration + phone, { data: registrationData, expiry }, REGISTRATION_EXPIRY_SEC);
  } else {
    registrationStore.set(phone, { data: registrationData, expiry });
    cleanupExpiredRegistrationData();
  }
  logger.info(`Registration data stored for ${phone}`);
  return true;
};

export const getRegistrationData = async (phone) => {
  if (useRedis()) {
    const stored = await redisGet(PREFIX.registration + phone);
    if (!stored) return null;
    if (Date.now() > stored.expiry) {
      await redisDel(PREFIX.registration + phone);
      return null;
    }
    return stored.data;
  }

  const stored = registrationStore.get(phone);
  if (!stored) return null;
  if (Date.now() > stored.expiry) {
    registrationStore.delete(phone);
    return null;
  }
  return stored.data;
};

export const removeRegistrationData = async (phone) => {
  if (useRedis()) {
    await redisDel(PREFIX.registration + phone);
  } else {
    registrationStore.delete(phone);
  }
  logger.info(`Registration data removed for ${phone}`);
};

const cleanupExpiredRegistrationData = () => {
  const now = Date.now();
  for (const [phone, data] of registrationStore.entries()) {
    if (now > data.expiry) registrationStore.delete(phone);
  }
};
