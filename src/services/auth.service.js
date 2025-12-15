import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Passenger from '../models/Passenger.js';
import Driver from '../models/Driver.js';
import Admin from '../models/Admin.js';
import { generateOTP } from '../utils/helpers.js';
import { USER_ROLES } from '../config/constants.js';
import { uploadAndVerifyCNIC } from './cnic.service.js';
import logger from '../utils/logger.js';

// Load environment variablesxzad
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets are not defined in environment variables');
}

/**
 * Generate JWT access token
 * @param {Object} payload - Token payload
 * @returns {string} - JWT token
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Generate JWT refresh token
 * @param {Object} payload - Token payload
 * @returns {string} - JWT refresh token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });
};

/**
 * Verify JWT access token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Verify JWT refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object} - Decoded token payload
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};

/**
 * Register new user
 * @param {Object} userData - User registration data
 * @param {Object} cnicImageFile - CNIC image file (required)
 * @returns {Promise<Object>} - Created user and profile
 */
export const registerUser = async (userData, cnicImageFile) => {
  const { email, phone, password, role, cnic, name } = userData;

  // Validate that CNIC image is provided
  if (!cnicImageFile) {
    throw new Error('CNIC image is required for registration');
  }

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { phone }, { cnic }],
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new Error('Email already registered');
    }
    if (existingUser.phone === phone) {
      throw new Error('Phone number already registered');
    }
    if (existingUser.cnic === cnic) {
      throw new Error('CNIC already registered');
    }
  }

  // Create user first (without CNIC image initially)
  const user = new User({
    email,
    phone,
    password,
    role,
    cnic,
    cnicImage: null, // Will be updated after upload
    cnicVerificationStatus: 'pending',
  });
  await user.save();
  console.log('✅ User created with ID:', user._id);

  // Now upload CNIC image with the user ID
  let cnicImageUrl = null;
  try {
    console.log('🔄 Uploading CNIC image for user:', user._id);
    const uploadResult = await uploadAndVerifyCNIC(cnicImageFile, user._id, cnic);
    cnicImageUrl = uploadResult.imageUrl;

    // Update user with CNIC image URL
    user.cnicImage = cnicImageUrl;
    await user.save();
    console.log('✅ CNIC image uploaded and user updated');
  } catch (uploadError) {
    console.error('❌ CNIC upload failed during registration:', uploadError);
    // Don't throw error here - allow registration to complete
    // User can upload CNIC later through separate endpoint
    logger.warn('CNIC upload failed, but continuing with registration');
  }

  // Create role-specific profile
  let profile;
  if (role === USER_ROLES.PASSENGER) {
    profile = new Passenger({
      userId: user._id,
      name,
    });
    await profile.save();
  } else if (role === USER_ROLES.DRIVER) {
    profile = new Driver({
      userId: user._id,
      name,
    });
    await profile.save();
  } else if (role === USER_ROLES.ADMIN) {
    profile = new Admin({
      userId: user._id,
      name,
    });
    await profile.save();
  }

  // Generate tokens
  const tokenPayload = {
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Save refresh token to user
  user.refreshToken = refreshToken;
  await user.save();

  return {
    user: {
      _id: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      cnicImage: user.cnicImage,
      cnicVerificationStatus: user.cnicVerificationStatus,
    },
    profile,
    accessToken,
    refreshToken,
  };
};

/**
 * Login user
 * @param {Object} credentials - Login credentials (email/phone and password)
 * @returns {Promise<Object>} - User data and tokens
 */
export const loginUser = async (credentials) => {
  const { email, phone, password } = credentials;

  // Find user by email or phone
  const user = await User.findOne({
    $or: email ? [{ email }] : [{ phone }],
  }).select('+password');

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check if user is blocked
  if (user.isBlocked) {
    throw new Error('Account is blocked. Please contact support.');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new Error('Account is inactive. Please contact support.');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Get user profile
  let profile = null;
  if (user.role === USER_ROLES.PASSENGER) {
    profile = await Passenger.findOne({ userId: user._id });
  } else if (user.role === USER_ROLES.DRIVER) {
    profile = await Driver.findOne({ userId: user._id });
  } else if (user.role === USER_ROLES.ADMIN) {
    profile = await Admin.findOne({ userId: user._id });
  }

  // Generate tokens
  const tokenPayload = {
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  return {
    user: {
      _id: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
    },
    profile,
    accessToken,
    refreshToken,
  };
};

/**
 * Generate OTP for phone verification
 * @param {string} phone - Phone number
 * @returns {Promise<string>} - Generated OTP
 */
export const generateOTPForPhone = async (phone) => {
  // In production, this would send OTP via SMS
  // For now, we'll just generate and return it
  const otp = generateOTP(6);
  logger.info(`OTP for ${phone}: ${otp}`); // Remove in production
  return otp;
};

/**
 * Refresh access token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} - New access token
 */
export const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = verifyRefreshToken(refreshToken);

    // Find user and verify refresh token
    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      throw new Error('Invalid refresh token');
    }

    // Generate new access token
    const tokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    const accessToken = generateAccessToken(tokenPayload);

    return { accessToken };
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

/**
 * Logout user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    $unset: { refreshToken: 1 },
  });
};

