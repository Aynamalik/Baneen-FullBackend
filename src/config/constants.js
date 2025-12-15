/**
 * Application constants
 */

export const USER_ROLES = {
  PASSENGER: 'passenger',
  DRIVER: 'driver',
  ADMIN: 'admin',
};

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
};

export const RIDE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

export const PAYMENT_METHODS = {
  CASH: 'cash',
  EASYPAISA: 'easypaisa',
  JAZZCASH: 'jazzcash',
  CARD: 'card',
};

export const RIDE_TYPES = {
  ONE_TIME: 'one-time',
  SUBSCRIPTION: 'subscription',
};

export const SOS_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  FALSE_ALARM: 'false-alarm',
};

export const COMPLAINT_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

export const COMPLAINT_TYPES = {
  DRIVER: 'driver',
  PASSENGER: 'passenger',
  APP: 'app',
  PAYMENT: 'payment',
  OTHER: 'other',
};

export const NOTIFICATION_TYPES = {
  RIDE: 'ride',
  PAYMENT: 'payment',
  SOS: 'sos',
  SYSTEM: 'system',
  CHAT: 'chat',
};

export const DRIVER_AVAILABILITY = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy',
};

export const VEHICLE_TYPES = {
  CAR: 'car',
  BIKE: 'bike',
  AUTO: 'auto',
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

// File upload limits
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
};

// OTP configuration
export const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
};

// JWT token expiry
export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: '15m',
  REFRESH_TOKEN: '7d',
};

