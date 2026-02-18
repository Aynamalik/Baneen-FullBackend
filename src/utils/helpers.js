
export const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let OTP = '';
  for (let i = 0; i < length; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
  return OTP;
};
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
 * Format phone to E.164 for Pakistan (+92 + 10 digits). Safe for string or number.
 */
export const formatPhoneNumber = (phone) => {
  const cleaned = String(phone ?? '').replace(/\D/g, '');
  // Pakistan: 92 + 10-digit national number (drop leading 0 if present)
  if (cleaned.startsWith('92') && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.startsWith('92') && cleaned.length > 12) return `+${cleaned.slice(0, 12)}`;
  if (cleaned.startsWith('0') && cleaned.length >= 11) return `+92${cleaned.slice(1, 11)}`;
  if (cleaned.length >= 10) return `+92${cleaned.slice(-10)}`; // last 10 digits
  return `+92${cleaned}`;
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
 * Accepts: 10 digits (3xxxxxxxxx), 11 with leading 0 (03xxxxxxxxx), or with 92/+92 prefix
 * @param {string|number} phone - Phone number (string or number; leading 0 may be lost if sent as number in JSON)
 * @returns {boolean} - True if valid
 */
export const isValidPhone = (phone) => {
  if (phone == null || phone === '') return false;
  const cleaned = String(phone).replace(/\D/g, '');
  const phoneRegex = /^(\+92|92|0)?[0-9]{10}$/;
  return phoneRegex.test(cleaned);
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

