import { USER_ROLES } from '../config/constants.js';
import { sendError } from '../utils/response.js';

/**
 * Role-based access control middleware
 * @param {...string} allowedRoles - Allowed roles
 * @returns {Function} - Express middleware function
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', 403);
    }

    next();
  };
};

/**
 * Check if user is admin
 */
export const isAdmin = authorize(USER_ROLES.ADMIN);

/**
 * Check if user is driver
 */
export const isDriver = authorize(USER_ROLES.DRIVER);

/**
 * Check if user is passenger
 */
export const isPassenger = authorize(USER_ROLES.PASSENGER);

/**
 * Check if user is driver or passenger
 */
export const isDriverOrPassenger = authorize(USER_ROLES.DRIVER, USER_ROLES.PASSENGER);

/**
 * Check if user is verified
 */
export const requireVerification = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 'Authentication required', 401);
  }

  if (!req.user.isVerified) {
    return sendError(res, 'Account verification required', 403);
  }

  next();
};

