import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter for OTP requests
 */
export const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1, // Limit each IP to 1 OTP request per minute
  message: 'Please wait before requesting another OTP.',
  standardHeaders: true,
  legacyHeaders: false,
});

