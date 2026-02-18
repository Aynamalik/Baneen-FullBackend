import Joi from 'joi';
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^(\+92|92|0)?[0-9]{10}$/).required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('passenger', 'driver').required(),
  cnic: Joi.string().pattern(/^[0-9]{5}-[0-9]{7}-[0-9]{1}$/).required(),
  name: Joi.string().min(2).max(50).required(),
  // CNIC image will be validated separately in the upload middleware
});

// CNIC upload validation
export const cnicUploadSchema = Joi.object({
  userId: Joi.string().required(),
});

// Login validation
export const loginSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^(\+92|92|0)?[0-9]{10}$/).optional(),
  password: Joi.string().required(),
}).or('email', 'phone');

// OTP verification validation - accepts verificationToken (no phone needed) OR phone for backward compatibility
export const verifyOTPSchema = Joi.object({
  verificationToken: Joi.string().optional(),
  phone: Joi.string().pattern(/^(\+92|92|0)?[0-9]{10}$/).optional(),
  otp: Joi.string().length(6).required(),
}).or('verificationToken', 'phone').messages({
  'object.missing': 'Either verificationToken or phone is required',
});

// Password reset request validation
export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().optional(),
  phone: Joi.string().trim().pattern(/^(\+92|92|0)?[0-9]{10}$/).optional(),
}).or('email', 'phone');

// Password reset validation
export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

export const verifyResetOtpSchema = Joi.object({
  identifier: Joi.alternatives().try(
    Joi.string().email(),
    Joi.string().pattern(/^(\+92|92|0)?[0-9]{10}$/)
  ).required(),
  otp: Joi.string().length(6).required(),
});

// Profile update validation
export const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^(\+92|92|0)?[0-9]{10}$/).optional(),
});

// Ride request validation
export const rideRequestSchema = Joi.object({
  pickupLocation: Joi.string().required(),
  dropoffLocation: Joi.string().required(),
  pickupCoords: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
  }).optional(),
  dropoffCoords: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
  }).optional(),
  paymentMethod: Joi.string().valid('cash', 'easypaisa', 'jazzcash', 'card').required(),
  vehicleType: Joi.string().valid('car', 'bike', 'auto').required(),
  rideType: Joi.string().valid('one-time', 'subscription').default('one-time'),
  notes: Joi.string().max(500).optional(),
});

// Emergency contact validation
export const emergencyContactSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  phone: Joi.string().pattern(/^(\+92|92|0)?[0-9]{10}$/).required(),
  relationship: Joi.string().min(2).max(30).required(),
});

// Vehicle registration validation
export const vehicleSchema = Joi.object({
  type: Joi.string().valid('car', 'bike', 'auto').required(),
  make: Joi.string().required(),
  model: Joi.string().required(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).required(),
  color: Joi.string().required(),
  registrationNumber: Joi.string().required(),
  capacity: Joi.number().integer().min(1).max(10).required(),
});

// Payment processing validation
export const paymentSchema = Joi.object({
  rideId: Joi.string().optional(),
  amount: Joi.number().positive().required(),
  method: Joi.string().valid('cash', 'easypaisa', 'jazzcash', 'card').required(),
  type: Joi.string().valid('ride', 'subscription', 'refund').required(),
});

// SOS alert validation
export const sosAlertSchema = Joi.object({
  rideId: Joi.string().required(),
  location: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    address: Joi.string().optional(),
  }).required(),
});

export const registerPassengerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\d{10,15}$/).required(),
  cnic: Joi.string().pattern(/^\d{13}$/).required(),
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({ 'any.only': 'Password and confirm password must match' }),
});
// Complaint validation
export const complaintSchema = Joi.object({
  rideId: Joi.string().optional(),
  type: Joi.string().valid('driver', 'passenger', 'app', 'payment', 'other').required(),
  subject: Joi.string().min(5).max(100).required(),
  description: Joi.string().min(10).max(1000).required(),
});

// Subscription plan validation
export const subscriptionPlanSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  description: Joi.string().max(200).optional(),
  ridesIncluded: Joi.number().integer().positive().required(),
  price: Joi.number().positive().required(),
  validityDays: Joi.number().integer().positive().required(),
});

