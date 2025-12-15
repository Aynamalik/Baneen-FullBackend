/**
 * Helper utility functions
 */

/**
 * Generate random OTP
 * @param {number} length - OTP length
 * @returns {string} - Generated OTP
 */
export const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let OTP = '';
  for (let i = 0; i < length; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
  return OTP;
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

/**
 * Format phone number
 * @param {string} phone - Phone number
 * @returns {string} - Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format for Pakistan (assuming +92 country code)
  if (cleaned.startsWith('92')) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith('0')) {
    return `+92${cleaned.substring(1)}`;
  } else if (cleaned.length === 10) {
    return `+92${cleaned}`;
  }
  
  return `+${cleaned}`;
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} - True if valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Pakistan format)
 * @param {string} phone - Phone number
 * @returns {boolean} - True if valid
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^(\+92|92|0)?[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

/**
 * Validate CNIC (Pakistan format)
 * @param {string} cnic - CNIC number
 * @returns {boolean} - True if valid
 */
export const isValidCNIC = (cnic) => {
  const cnicRegex = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;
  return cnicRegex.test(cnic);
};

/**
 * Sanitize string input
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

/**
 * Generate unique ID
 * @returns {string} - Unique ID
 */
export const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Calculate pagination
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} - Pagination object
 */
export const calculatePagination = (page, limit, total) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
  const skip = (pageNum - 1) * limitNum;
  const totalPages = Math.ceil(total / limitNum);

  return {
    page: pageNum,
    limit: limitNum,
    skip,
    total,
    totalPages,
  };
};

