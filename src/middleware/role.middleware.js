import { USER_ROLES } from '../config/constants.js';
import { sendError } from '../utils/response.js';

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


export const isAdmin = authorize(USER_ROLES.ADMIN);


export const isDriver = authorize(USER_ROLES.DRIVER);

export const isPassenger = authorize(USER_ROLES.PASSENGER);

export const isDriverOrPassenger = authorize(USER_ROLES.DRIVER, USER_ROLES.PASSENGER);

export const requireRole = (allowedRoles) => {
  return authorize(...allowedRoles);
};

export const requireVerification = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 'Authentication required', 401);
  }

  if (!req.user.isVerified) {
    return sendError(res, 'Account verification required', 403);
  }

  next();
};

