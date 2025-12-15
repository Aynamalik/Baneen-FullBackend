import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  generateOTPForPhone,
} from '../services/auth.service.js';
import { generateAndStoreOTP, verifyOTP as verifyOTPService } from '../services/otp.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Register new user
 */
export const register = async (req, res) => {
  try {
    const userData = req.body;
    const cnicImageFile = req.file; // CNIC image uploaded during registration
    const result = await registerUser(userData, cnicImageFile);

    return sendSuccess(
      res,
      {
        user: result.user,
        profile: result.profile,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      'User registered successfully',
      201
    );
  } catch (error) {
    logger.error('Registration error:', error);
    return sendError(res, error.message || 'Registration failed', 400);
  }
};

/**
 * Login user
 */
export const login = async (req, res) => {
  try {
    const credentials = req.body;
    const result = await loginUser(credentials);

    return sendSuccess(
      res,
      {
        user: result.user,
        profile: result.profile,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      'Login successful'
    );
  } catch (error) {
    logger.error('Login error:', error);
    return sendError(res, error.message || 'Login failed', 401);
  }
};

/**
 * Verify OTP
 */
export const verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return sendError(res, 'Phone and OTP are required', 400);
    }

    const isValid = verifyOTP(phone, otp);

    if (!isValid) {
      return sendError(res, 'Invalid or expired OTP', 400);
    }

    // Update user verification status
    const user = await User.findOne({ phone });
    if (user) {
      user.isVerified = true;
      await user.save();
    }

    return sendSuccess(res, { verified: true }, 'OTP verified successfully');
  } catch (error) {
    logger.error('OTP verification error:', error);
    return sendError(res, 'OTP verification failed', 400);
  }
};

/**
 * Request OTP
 */
export const requestOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return sendError(res, 'Phone number is required', 400);
    }

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Generate and store OTP
    const otp = generateAndStoreOTP(phone);

    // In production, send OTP via SMS
    // For now, we'll just return success
    // await sendSMS(phone, `Your OTP is: ${otp}`);

    return sendSuccess(
      res,
      { message: 'OTP sent successfully' },
      'OTP sent to your phone'
    );
  } catch (error) {
    logger.error('OTP request error:', error);
    return sendError(res, 'Failed to send OTP', 500);
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required', 400);
    }

    const result = await refreshAccessToken(refreshToken);

    return sendSuccess(res, result, 'Token refreshed successfully');
  } catch (error) {
    logger.error('Token refresh error:', error);
    return sendError(res, error.message || 'Token refresh failed', 401);
  }
};

/**
 * Logout user
 */
export const logout = async (req, res) => {
  try {
    const userId = req.user.userId;
    await logoutUser(userId);

    return sendSuccess(res, null, 'Logout successful');
  } catch (error) {
    logger.error('Logout error:', error);
    return sendError(res, 'Logout failed', 500);
  }
};

/**
 * Get current user profile
 */
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Get role-specific profile
    let profile = null;
    if (user.role === 'passenger') {
      const Passenger = (await import('../models/Passenger.js')).default;
      profile = await Passenger.findOne({ userId: user._id });
    } else if (user.role === 'driver') {
      const Driver = (await import('../models/Driver.js')).default;
      profile = await Driver.findOne({ userId: user._id });
    } else if (user.role === 'admin') {
      const Admin = (await import('../models/Admin.js')).default;
      profile = await Admin.findOne({ userId: user._id });
    }

    return sendSuccess(
      res,
      {
        user: {
          _id: user._id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isVerified: user.isVerified,
          isActive: user.isActive,
          profileImage: user.profileImage,
          cnicImage: user.cnicImage,
          cnicVerificationStatus: user.cnicVerificationStatus,
          cnicVerifiedAt: user.cnicVerifiedAt,
        },
        profile,
      },
      'User profile retrieved successfully'
    );
  } catch (error) {
    logger.error('Get current user error:', error);
    return sendError(res, 'Failed to get user profile', 500);
  }
};

/**
 * Forgot password - Request password reset
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;
    
    if (!email && !phone) {
      return sendError(res, 'Email or phone is required', 400);
    }

    const user = await User.findOne({
      $or: email ? [{ email }] : [{ phone }],
    });

    if (!user) {
      // Don't reveal if user exists for security
      return sendSuccess(
        res,
        { message: 'If the account exists, a password reset link has been sent' },
        'Password reset requested'
      );
    }

    // Generate OTP for password reset
    const otp = generateAndStoreOTP(user.phone);

    // In production, send reset link/OTP via email/SMS
    logger.info(`Password reset OTP for ${user.phone}: ${otp}`);

    return sendSuccess(
      res,
      { message: 'Password reset instructions sent' },
      'Password reset requested'
    );
  } catch (error) {
    logger.error('Forgot password error:', error);
    return sendError(res, 'Failed to process password reset request', 500);
  }
};

/**
 * Reset password
 */
export const resetPassword = async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;

    if (!phone || !otp || !newPassword) {
      return sendError(res, 'Phone, OTP, and new password are required', 400);
    }

    // Verify OTP
    const isValid = verifyOTPService(phone, otp);
    if (!isValid) {
      return sendError(res, 'Invalid or expired OTP', 400);
    }

    // Find user and update password
    const user = await User.findOne({ phone }).select('+password');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    user.password = newPassword;
    await user.save();

    return sendSuccess(res, null, 'Password reset successfully');
  } catch (error) {
    logger.error('Reset password error:', error);
    return sendError(res, 'Failed to reset password', 500);
  }
};

