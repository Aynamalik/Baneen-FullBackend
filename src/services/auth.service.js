import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Passenger from '../models/Passenger.js';
import Driver from '../models/Driver.js';
import Admin from '../models/Admin.js';
import { generateOTP } from '../utils/helpers.js';
import { USER_ROLES } from '../config/constants.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import { DRIVER_AVAILABILITY } from '../config/constants.js';

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets are not defined in environment variables');
}
const BASE_FARE = 100;
const PER_KM_RATE = 30;
const DRIVER_SEARCH_RADIUS_KM = 5;

// 🔹 Google Maps Distance Helper
export const getDistanceFromGoogle = async (pickup, dropoff) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${pickup.latitude},${pickup.longitude}&destinations=${dropoff.latitude},${dropoff.longitude}&key=${apiKey}`;

  const response = await axios.get(url);

  console.log('GOOGLE RAW RESPONSE:', JSON.stringify(response.data, null, 2));

  const element = response?.data?.rows?.[0]?.elements?.[0];

  if (!element) {
    throw new Error(
      response?.data?.error_message || 'Invalid Google Maps response'
    );
  }

  return {
    distanceMeters: element.distance.value,
    durationSeconds: element.duration.value,
  };
};

export const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};

import bcrypt from 'bcryptjs';

export const registerDriverService = async (userData, files) => {
  const { name, email, phone, alternatePhone, cnic, password, vehicleType, vehicleName, owner, address } = userData;

  // 1️⃣ Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new Error('Email already registered');

  const existingCnic = await User.findOne({ cnic });
  if (existingCnic) throw new Error('CNIC is already registered with another account');

  // 2️⃣ Create user (password will be hashed by pre-save middleware)
  // Note: User model doesn't have 'name' field - name is stored in Driver profile
  const user = await User.create({
    email,
    phone,
    alternatePhone,
    cnic,
    cnicImage: files.cnicImage, // Store CNIC image in User model
    password: password, // Plain text - will be hashed by User model pre-save middleware
    role: 'driver'
  });

  // 3️⃣ Create driver profile with uploaded files and vehicle information
  const profile = await Driver.create({
    userId: user._id,
    name: name,
    address: address,
    licenseImage: files.licensePic, // Driver model has 'licenseImage' field, not 'licensePic'
    vehicle: {
      vehicleType: vehicleType,
      vehicleName: vehicleName,
      owner: owner
    }
   
  });

  // 4️⃣ Generate tokens
  const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

  logger.info(`Driver registered successfully: ${email}`);

  return { user, profile, accessToken, refreshToken };
};
export const registerPassengerService = async (userData, files) => {
  const { name, email, phone, cnic, password } = userData;

  if(!name || !email || !phone || !cnic || !password) throw new Error('All fields are required');

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new Error('Email already registered');

  const existingCnic = await User.findOne({ cnic });
  if (existingCnic) throw new Error('CNIC is already registered with another account');

  // Create user (password will be hashed by pre-save middleware)
  const user = await User.create({
    email,
    phone,
    cnic,
    password: password, // Plain text - will be hashed by User model pre-save middleware
    role: 'passenger'
  });

  // Create passenger profile with CNIC picture
  console.log('Creating passenger with:', {
    userId: user._id,
    name: name,
    cnicImage: files.cnicImage
  });
  const profile = await Passenger.create({
    userId: user._id,
    name: name,
    cnicImage: files.cnicImage
  });

  // Generate JWT tokens
  const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

  logger.info(`Passenger registered: ${email}`);

  return { user, profile, accessToken, refreshToken };
};

export const loginUser = async (credentials) => {
  const { email, phone, password } = credentials;

  // Find user by email or phone
  let query;
  if (email && phone) {
    // If both are provided, try to match either
    query = { $or: [{ email }, { phone }] };
  } else if (email) {
    query = { email };
  } else if (phone) {
    query = { phone };
  } else {
    throw new Error('Email or phone is required');
  }

  const user = await User.findOne(query).select('+password');

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (user.isBlocked) { 
    throw new Error('Account is blocked. Please contact support.');
  }

 
  if (!user.isActive) {
    throw new Error('Account is inactive. Please contact support.');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

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

export const generateOTPForPhone = async (phone) => {
  const otp = generateOTP(6);
  logger.info(`OTP for ${phone}: ${otp}`); 
  return otp;
};

export const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      throw new Error('Invalid refresh token');
    }

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


export const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    $unset: { refreshToken: 1 },
  });
};

