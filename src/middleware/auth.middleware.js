import { verifyAccessToken } from '../services/auth.service.js';
import User from '../models/User.js';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

export const authenticate = async (req, res, next) => {
  try {
   
    let token = req.cookies?.accessToken;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); 
      }
    }

    if (!token) {
      return sendError(res, 'No token provided', 401);
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return sendError(res, 'Token expired', 401);
      }
      return sendError(res, 'Invalid token', 401);
    }

    
    const user = await User.findById(decoded.userId);

    if (!user) {
      return sendError(res, 'User not found', 401);
    }

    if (!user.isActive || user.isBlocked) {
      return sendError(res, 'Account is inactive or blocked', 403);
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
    };

    console.log("This is user object from middleware---------->",req.user)

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return sendError(res, 'Authentication failed', 401);
  }
};


export const optionalAuthenticate = async (req, res, next) => {
  try {
  
    let token = req.cookies?.accessToken;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
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
      
      }
    }

    next();
  } catch (error) {
    next();
  }
};

