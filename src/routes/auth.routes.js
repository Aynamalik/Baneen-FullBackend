import express from 'express';
import {
  register,
  login,
  verifyOTP,
  requestOTP,
  refreshToken,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import {
  registerSchema,
  loginSchema,
  verifyOTPSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validators.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.middleware.js';
import { uploadCNICImage, validateCNICImage } from '../middleware/upload.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user with CNIC image
 * @access  Public
 */
router.post(
  '/register',
  authLimiter,
  uploadCNICImage,
  validateCNICImage,
  validate(registerSchema),
  register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',authLimiter, validate(loginSchema), login);

/**
 * @route   POST /api/v1/auth/request-otp
 * @desc    Request OTP for verification
 * @access  Public
 */
router.post('/request-otp', otpLimiter, requestOTP);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP
 * @access  Public
 */
router.post('/verify-otp', validate(verifyOTPSchema), verifyOTP);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with OTP
 * @access  Public
 */
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', refreshToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, getCurrentUser);

export default router;

