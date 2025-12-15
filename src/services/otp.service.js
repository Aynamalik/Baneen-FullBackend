import { generateOTP } from '../utils/helpers.js';
import logger from '../utils/logger.js';

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

const OTP_EXPIRY = 10 * 60 * 1000; // 10 minutes

/**
 * Generate and store OTP
 * @param {string} phone - Phone number
 * @returns {string} - Generated OTP
 */
export const generateAndStoreOTP = (phone) => {
  const otp = generateOTP(6);
  const expiry = Date.now() + OTP_EXPIRY;

  otpStore.set(phone, {
    otp,
    expiry,
    attempts: 0,
  });

  // Log OTP for development (remove in production)
  logger.info(`OTP for ${phone}: ${otp}`);

  // Clean up expired OTPs
  cleanupExpiredOTPs();

  return otp;
};

/**
 * Verify OTP
 * @param {string} phone - Phone number
 * @param {string} otp - OTP to verify
 * @returns {boolean} - True if valid
 */
export const verifyOTP = (phone, otp) => {
  const stored = otpStore.get(phone);

  if (!stored) {
    return false;
  }

  // Check if expired
  if (Date.now() > stored.expiry) {
    otpStore.delete(phone);
    return false;
  }

  // Check attempts (max 5 attempts)
  if (stored.attempts >= 5) {
    otpStore.delete(phone);
    return false;
  }

  // Verify OTP
  if (stored.otp !== otp) {
    stored.attempts += 1;
    return false;
  }

  // OTP verified, remove it
  otpStore.delete(phone);
  return true;
};

/**
 * Clean up expired OTPs
 */
const cleanupExpiredOTPs = () => {
  const now = Date.now();
  for (const [phone, data] of otpStore.entries()) {
    if (now > data.expiry) {
      otpStore.delete(phone);
    }
  }
};

/**
 * Get OTP expiry time remaining
 * @param {string} phone - Phone number
 * @returns {number} - Milliseconds remaining
 */
export const getOTPExpiry = (phone) => {
  const stored = otpStore.get(phone);
  if (!stored) {
    return 0;
  }
  return Math.max(0, stored.expiry - Date.now());
};

