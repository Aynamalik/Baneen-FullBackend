import express from 'express';
import {
  login,
  verifyOTP,
  requestOTP,
  refreshToken,
  logout,
  getCurrentUser,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  changePassword,
  verifyDriverOTP
} from '../controllers/auth.controller.js';
import { registerDriver,registerPassenger} from '../controllers/auth.controller.js';
import { registerDriverSchema} from '../utils/driver.schema.js';
import { registerPassengerSchema } from '../utils/validators.js';
import { validateFiles,handleUploads,cleanupTempFiles } from '../middleware/upload.middleware.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { injectVerificationTokenFromCookie, injectResetIdentifierFromCookie } from '../middleware/verificationToken.middleware.js';
import {
  registerSchema,
  loginSchema,
  verifyOTPSchema,
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../utils/validators.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

router.post(
  '/register-driver',authLimiter,
  handleUploads([
    { name: 'cnicImage', maxCount: 1, required: false },
    { name: 'licensePic', maxCount: 1 },
    { name: 'vehiclePermitPic', maxCount: 1, required: false }
  ]),
  validate(registerDriverSchema),
  registerDriver,
  cleanupTempFiles
);

router.post(
  '/register-passenger',
  authLimiter,
  handleUploads([]),
  validate(registerPassengerSchema),
  registerPassenger,
  cleanupTempFiles
);

router.post('/verify-driver-otp', injectVerificationTokenFromCookie, validate(verifyOTPSchema), verifyDriverOTP);

router.post('/login',authLimiter, validate(loginSchema), login);

router.post('/request-otp', otpLimiter, requestOTP);

router.post('/verify-otp', injectVerificationTokenFromCookie, validate(verifyOTPSchema), verifyOTP);

router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);

router.post('/verify-reset-otp', injectResetIdentifierFromCookie, validate(verifyResetOtpSchema), verifyResetOtp);

router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);

router.post('/refresh-token', refreshToken);

router.post('/logout', authenticate, logout);

router.get('/me', authenticate, getCurrentUser);

export default router;

