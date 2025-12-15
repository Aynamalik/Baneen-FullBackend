import { verifyAccessToken } from '../services/auth.service.js';
import User from '../models/User.js';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Authentication middleware - Verify JWT token
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No token provided', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return sendError(res, 'Token expired', 401);
      }
      return sendError(res, 'Invalid token', 401);
    }

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      return sendError(res, 'User not found', 401);
    }

    // Check if user is active and not blocked
    if (!user.isActive || user.isBlocked) {
      return sendError(res, 'Account is inactive or blocked', 403);
    }

    // Attach user to request
    req.user = {
      userId: user._id.toString(),
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return sendError(res, 'Authentication failed', 401);
  }
};

/**
 * Optional authentication - Attach user if token is valid, but don't require it
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyAccessToken(token);
        const user = await User.findById(decoded.userId);

        if (user && user.isActive && !user.isBlocked) {
          req.user = {
            userId: user._id.toString(),
            email: user.email,
            phone: user.phone,
            role: user.role,
            isVerified: user.isVerified,
          };
        }
      } catch (error) {
        // Ignore token errors for optional auth
      }
    }

    next();
  } catch (error) {
    next();
  }
};

