import {
  loginUser,
  refreshAccessToken,
  logoutUser,
  generateOTPForPhone,
  registerDriverService,
  registerPassengerService
} from '../services/auth.service.js';
import { uploadImage } from '../config/cloudinary.js';
import { verifyOtpCode } from "../utils/otp.js";
import { generateAndStoreOTP, verifyOTP as verifyOTPService, generateResetToken, verifyResetToken, storeRegistrationData, getRegistrationData, removeRegistrationData, generateVerificationToken, getPhoneFromVerificationToken, removeVerificationToken } from '../services/otp.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { formatPhoneNumber, isValidPhone } from '../utils/helpers.js';
import User from '../models/User.js';
import Driver from '../models/Driver.js';
import logger from '../utils/logger.js';
import { sendSMS } from '../services/sms.service.js';
import { sendOTPEmail } from '../services/email.service.js';
import jwt from 'jsonwebtoken';

export const registerDriver = async (req,res) =>{
  try {
    const userData = req.body;
    const cnicImageFile = req.files?.cnicImage?.[0];
    const vehiclePermitPic =  req.files?.vehiclePermitPic?.[0];
    const licensePic =  req.files?.licensePic?.[0];
    if (!cnicImageFile || !licensePic) {
      return sendError(res, 'Required documents are missing', 400);
    }

    if (!isValidPhone(userData.phone)) {
      logger.error(`Invalid phone number format: ${userData.phone}`);
      return sendError(res, 'Invalid phone number format. Please use a valid Pakistani phone number (e.g., +923001234567, 03001234567, or 3001234567).', 400);
    }

    const User = (await import('../models/User.js')).default;
    const existingUser = await User.findOne({
         email: userData.email 
      
    });
    if (existingUser) {
      return sendError(res, 'Email  already registered', 400);
    }

    const existingCnic = await User.findOne({ cnic: userData.cnic });
    if (existingCnic) {
      return sendError(res, 'CNIC is already registered with another account', 400);
    }

    const uploadPromises = [
      uploadImage(cnicImageFile.path, { folder: 'baneen/cnic' }).then((r) => r.url),
      uploadImage(licensePic.path, { folder: 'baneen/driver-license' }).then((r) => r.url),
    ];
    if (vehiclePermitPic) {
      uploadPromises.push(
        uploadImage(vehiclePermitPic.path, { folder: 'baneen/vehicle-permit' }).then((r) => r.url)
      );
    }

    let uploadedUrls;
    try {
      const results = await Promise.all(uploadPromises);
      uploadedUrls = {
        cnicImage: results[0],
        licensePic: results[1],
        vehiclePermitPic: results[2] || null,
      };
    } catch (uploadErr) {
      logger.error('Cloudinary upload failed:', uploadErr);
      return sendError(res, 'Failed to upload documents. Please try again.', 500);
    }

    const registrationData = {
      userData,
      files: uploadedUrls,
      type: 'driver'
    };

    const isTestNumber = process.env.NODE_ENV === 'development' && (userData.phone === '1234' || userData.phone === '1234567890' || userData.phone === '0000000000');
    const registrationKey = isTestNumber ? userData.phone : formatPhoneNumber(userData.phone);
    await storeRegistrationData(registrationKey, registrationData);

    const phoneForOTP = isTestNumber ? userData.phone : formatPhoneNumber(userData.phone);

    logger.info(`Original phone: ${userData.phone}, Phone for OTP: ${phoneForOTP}`);

    const otp = await generateAndStoreOTP(phoneForOTP);
    logger.info(`Generated OTP for driver registration: ${otp}`);

    const verificationToken = await generateVerificationToken(phoneForOTP);

    if (isTestNumber) {
      logger.info(`Skipping SMS send for test phone number: ${userData.phone}. OTP: ${otp}`);
    } else {
      const formattedPhone = formatPhoneNumber(userData.phone);
      try {
        await sendSMS(formattedPhone, `Your Baneen driver registration OTP is: ${otp}. This OTP will expire in 10 minutes.`);
      } catch (smsError) {
        if (process.env.NODE_ENV === 'development') {
          logger.warn(`SMS failed in development (e.g. Twilio trial). Use this OTP to verify: ${otp}`);
         
        } else {
          throw smsError;
        }
      }
    }

    res.cookie('verificationToken', verificationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, 
    });

    return sendSuccess(
      res,
      {
        message: 'OTP sent to your phone. Please verify to complete registration.',
        phone: userData.phone,
      },
      'Registration OTP sent successfully'
    );
  } catch (error) {
    logger.error('Driver registration OTP error:', error);
    if (error.code === 11000) {
      const field = error.keyPattern?.cnic ? 'CNIC' : error.keyPattern?.email ? 'Email' : 'Phone';
      return sendError(res, `${field} is already registered with another account`, 400);
    }
    return sendError(res, error.message || 'Failed to send registration OTP', 400);
  }
};
export const verifyDriverOTP = async (req, res) => {
  try {
    const { verificationToken: bodyToken, phone, otp } = req.body;
    const verificationToken = bodyToken || req.cookies?.verificationToken;

    if (!otp) return sendError(res, 'OTP is required', 400);

    let resolvedPhone;
    if (verificationToken) {
      resolvedPhone = await getPhoneFromVerificationToken(verificationToken);
      if (!resolvedPhone) return sendError(res, 'Invalid or expired verification token', 400);
      await removeVerificationToken(verificationToken);
    } else if (phone) {
      resolvedPhone = formatPhoneNumber(phone);
    } else {
      return sendError(res, 'Verification token or phone is required', 400);
    }

    const isValid = await verifyOTPService(resolvedPhone, otp);
    if (!isValid) return sendError(res, 'Invalid or expired OTP', 400);

    const registrationData = await getRegistrationData(resolvedPhone);
    if (!registrationData || registrationData.type !== 'driver') {
      return sendError(res, 'No registration data found. Please try registering again.', 400);
    }

    const result = await registerDriverService(
      registrationData.userData,
      registrationData.files
    );

    await removeRegistrationData(resolvedPhone);

    res.clearCookie('verificationToken');

    logger.info(`Driver registration completed successfully for phone: ${resolvedPhone}`);

    return sendSuccess(
      res,
      {
        user: result.user,
        profile: result.profile,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      'Driver registered successfully',
      201
    );
  } catch (error) {
    logger.error('Driver OTP verification error:', error);
    if (error.code === 11000) {
      const field = error.keyPattern?.cnic ? 'CNIC' : error.keyPattern?.email ? 'Email' : 'Phone';
      return sendError(res, `${field} is already registered with another account`, 400);
    }
    return sendError(res, error.message || 'Failed to verify OTP and complete registration', 500);
  }
};

export const login = async (req, res) => {
  try {
    const credentials = req.body;
    const result = await loginUser(credentials);

    console.log('🔐 Setting authentication cookies...');
    const cookieOptions = {
      httpOnly: true,
      secure: false, 
      sameSite: 'lax', 
      maxAge: 24 * 60 * 60 * 1000, 
    };

    res.cookie('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    console.log(' Access token cookie set');

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    console.log(' Refresh token cookie set');
    console.log(' Sending success response...');

    return sendSuccess(
      res,
      {
        user: result.user,
        profile: result.profile,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        message: 'Login successful. Tokens stored in cookies.',
      },
      'Login successful'
    );
  } catch (error) {
    logger.error('Login error:', error);
    return sendError(res, error.message || 'Login failed', 401);
  }
};

export const logout = async (req, res) => {
  try {
  
    const cookieOptions = {
      httpOnly: true,
      secure: false, 
      sameSite: 'lax',
    };

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);

    // Optionally clear refresh token from database
    if (req.user) {
      await User.findByIdAndUpdate(req.user.userId, { refreshToken: null });
    }

    return sendSuccess(res, { message: 'Logged out successfully' }, 'Logout successful');
  } catch (error) {
    logger.error('Logout error:', error);
    return sendError(res, 'Logout failed', 500);
  }
};

export const registerPassenger = async (req, res) => {
  try {
    const userData = req.body;
    const cnicImageFile = req.files?.cnicImage?.[0];

    if (!cnicImageFile) {
      return sendError(res, 'CNIC image is required', 400);
    }

    // Validate phone number
    if (!isValidPhone(userData.phone)) {
      logger.error(`Invalid phone number format: ${userData.phone}`);
      return sendError(res, 'Invalid phone number format. Please use a valid Pakistani phone number (e.g., +923001234567, 03001234567, or 3001234567).', 400);
    }
    const User = (await import('../models/User.js')).default;
    const existingUser = await User.findOne({
    
         email: userData.email 
    
    });
    if (existingUser) {
      return sendError(res, 'Email already registered', 400);
    }

    const existingCnic = await User.findOne({ cnic: userData.cnic });
    if (existingCnic) {
      return sendError(res, 'CNIC is already registered with another account', 400);
    }

    let cnicImageUrl;
    try {
      const uploadResult = await uploadImage(cnicImageFile.path, { folder: 'baneen/cnic' });
      cnicImageUrl = uploadResult.url;
    } catch (uploadErr) {
      logger.error('Cloudinary upload failed:', uploadErr);
      return sendError(res, 'Failed to upload CNIC image. Please try again.', 500);
    }

  
    const registrationData = {
      userData,
      files: {
        cnicImage: cnicImageUrl
      },
      type: 'passenger'
    };

    const isTestNumber = process.env.NODE_ENV === 'development' && (userData.phone === '1234' || userData.phone === '1234567890' || userData.phone === '0000000000');
    const registrationKey = isTestNumber ? userData.phone : formatPhoneNumber(userData.phone);
    await storeRegistrationData(registrationKey, registrationData);

    const phoneForOTP = isTestNumber ? userData.phone : formatPhoneNumber(userData.phone);

    logger.info(`Original phone: ${userData.phone}, Phone for OTP: ${phoneForOTP}`);

    const otp = await generateAndStoreOTP(phoneForOTP);
    logger.info(`Generated OTP for passenger registration: ${otp}`);

    const verificationToken = await generateVerificationToken(phoneForOTP);

    if (isTestNumber) {
      logger.info(`Skipping SMS send for test phone number: ${userData.phone}. OTP: ${otp}`);
    } else {
      const formattedPhone = formatPhoneNumber(userData.phone);
      await sendSMS(formattedPhone, `Your Baneen passenger registration OTP is: ${otp}. This OTP will expire in 10 minutes.`);
    }

    res.cookie('verificationToken', verificationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, 
    });

    return sendSuccess(
      res,
      {
        message: 'OTP sent to your phone. Please verify to complete registration.',
        phone: userData.phone,
      },
      'Registration OTP sent successfully'
    );
  } catch (error) {
    logger.error('Passenger registration OTP error:', error);
    if (error.code === 11000) {
      const field = error.keyPattern?.cnic ? 'CNIC' : error.keyPattern?.email ? 'Email' : 'Phone';
      return sendError(res, `${field} is already registered with another account`, 400);
    }
    return sendError(res, error.message || 'Failed to send registration OTP', 400);
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { verificationToken: bodyToken, phone, otp } = req.body || {};
    const verificationToken = bodyToken || req.cookies?.verificationToken;

    if (!otp) return sendError(res, 'OTP is required', 400);

    let resolvedPhone;
    if (verificationToken) {
      resolvedPhone = await getPhoneFromVerificationToken(verificationToken);
      if (!resolvedPhone) return sendError(res, 'Invalid or expired verification token', 400);
      await removeVerificationToken(verificationToken);
    } else if (phone) {
      resolvedPhone = formatPhoneNumber(phone);
    } else {
      return sendError(res, 'Verification token or phone is required', 400);
    }

    const isValid = await verifyOTPService(resolvedPhone, otp);
    if (!isValid) return sendError(res, 'Invalid or expired OTP', 400);

    const registrationData = await getRegistrationData(resolvedPhone);

    if (registrationData) {
      // Complete registration
      let result;
      if (registrationData.type === 'driver') {
        result = await registerDriverService(
          registrationData.userData,
          registrationData.files
        );
      } else if (registrationData.type === 'passenger') {
        result = await registerPassengerService(
          registrationData.userData,
          registrationData.files
        );
      }

    
      await removeRegistrationData(resolvedPhone);

      res.clearCookie('verificationToken');

      logger.info(`${registrationData.type} registration completed successfully for phone: ${resolvedPhone}`);

      return sendSuccess(
        res,
        {
          user: result.user,
          profile: result.profile,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        `${registrationData.type === 'driver' ? 'Driver' : 'Passenger'} registered successfully`,
        201
      );
    } else {
      
      const user = await User.findOne({ phone: resolvedPhone });
      if (user) {
        user.isVerified = true;
        await user.save();
      }

      return sendSuccess(res, { verified: true }, 'OTP verified successfully');
    }
  } catch (error) {
    logger.error('OTP verification error:', error);
    if (error.code === 11000) {
      const field = error.keyPattern?.cnic ? 'CNIC' : error.keyPattern?.email ? 'Email' : 'Phone';
      return sendError(res, `${field} is already registered with another account`, 400);
    }
    return sendError(res, error.message || 'OTP verification failed', 400);
  }
};

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

    const formattedPhone = formatPhoneNumber(phone);
    const otp = await generateAndStoreOTP(formattedPhone);
    await sendSMS(formattedPhone, `Your Baneen OTP is ${otp}`);

    return sendSuccess(
      res,
      null,
      'OTP sent to your phone'
    );
  } catch (error) {
    logger.error('OTP request error:', error);
    return sendError(res, 'Failed to send OTP', 500);
  }
};


export const refreshToken = async (req, res) => {
  try {
  
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required', 400);
    }

    const result = await refreshAccessToken(refreshToken);

    const cookieOptions = {
      httpOnly: true,
      secure: false, 
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    };

    res.cookie('accessToken', result.accessToken, cookieOptions);

    return sendSuccess(res, {
      message: 'Token refreshed successfully. New access token set in cookie.'
    }, 'Token refreshed successfully');
  } catch (error) {
    logger.error('Token refresh error:', error);
    return sendError(res, error.message || 'Token refresh failed', 401);
  }
};


export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }


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

export const forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return sendError(res, 'Email or phone is required', 400);
    }
    const user = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : [])
      ],
    });

    if (!user) {
      return sendSuccess(
        res,
        { message: 'If the account exists, a password reset OTP has been sent' },
        'Password reset requested'
      );
    }

    let deliveryMethod = '';

    if (phone) {
      try {
        const isTestNumber = process.env.NODE_ENV === 'development' && (phone === '1234' || phone === '1234567890' || phone === '0000000000' || phone === '03001234567');
        const phoneForOTP = isTestNumber ? phone : formatPhoneNumber(phone);

        const otp = await generateAndStoreOTP(phoneForOTP);

        if (isTestNumber) {
          logger.info(`Skipping SMS send for test phone number: ${phone}. OTP: ${otp}`);
        } else {
          await sendSMS(phoneForOTP, `Your Baneen password reset OTP is: ${otp}`);
        }

        deliveryMethod = 'phone';
        logger.info(`Password reset OTP sent to phone: ${phoneForOTP}`);
      } catch (error) {
        logger.error('Failed to send SMS:', error);
        return sendError(res, 'Failed to send OTP to phone. Please try again later.', 500);
      }
    } else if (email) {
      try {
        const otp = await generateAndStoreOTP(email);
        await sendOTPEmail(email, otp);
        deliveryMethod = 'email';
        logger.info(`Password reset OTP sent to email: ${email}`);
      } catch (error) {
        logger.error('Failed to send email:', error);
        return sendError(res, 'Failed to send OTP to email. Please try again later.', 500);
      }
    }

    const identifier = phone || email;
    res.cookie('resetIdentifier', identifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });

    return sendSuccess(
      res,
      {
        message: `Password reset OTP sent to your ${deliveryMethod}`,
        deliveryMethod
      },
      'Password reset requested'
    );
  } catch (error) {
    logger.error('Forgot password error:', error);
    return sendError(res, 'Failed to process password reset request', 500);
  }
};


export const verifyResetOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || !otp) {
      return sendError(res, 'Identifier (email/phone) and OTP are required', 400);
    }

    // Normalize identifier for OTP lookup (must match what forgot-password used)
    const isTestNumber = process.env.NODE_ENV === 'development' &&
      ['1234', '1234567890', '0000000000', '03001234567'].includes(identifier);
    const isPhone = /^(\+92|92|0)?[0-9]{10}$/.test(String(identifier).replace(/\D/g, ''));
    const otpLookupKey = isPhone
      ? (isTestNumber ? identifier : formatPhoneNumber(identifier))
      : identifier;

    const isValid = await verifyOTPService(otpLookupKey, otp);
    if (!isValid) {
      return sendError(res, 'Invalid or expired OTP', 400);
    }

    // Find user - try both raw and formatted phone for DB lookup
    const phoneQuery = isPhone
      ? [{ phone: identifier }, { phone: formatPhoneNumber(identifier) }]
      : [];
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { phone: identifier },
        ...phoneQuery,
      ],
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Use user's actual email/phone from DB so reset-password can find them
    const tokenIdentifier = isPhone ? user.phone : user.email;
    const resetToken = await generateResetToken(tokenIdentifier);

    res.clearCookie('resetIdentifier');

    return sendSuccess(
      res,
      {
        resetToken,
        message: 'OTP verified successfully. Use this token to reset your password.'
      },
      'OTP verified'
    );
  } catch (error) {
    logger.error('Verify reset OTP error:', error);
    return sendError(res, 'Failed to verify OTP', 500);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return sendError(res, 'Reset token and new password are required', 400);
    }

    // Verify reset token
    const identifier = await verifyResetToken(token);
    if (!identifier) {
      return sendError(res, 'Invalid or expired reset token', 400);
    }

  
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { phone: identifier }
      ],
    }).select('+password');

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Set plain password - User model pre-save hook will hash it
    user.password = newPassword;
    await user.save();

    return sendSuccess(res, null, 'Password reset successfully');
  } catch (error) {
    logger.error('Reset password error:', error);
    return sendError(res, 'Failed to reset password', 500);
  }
};

