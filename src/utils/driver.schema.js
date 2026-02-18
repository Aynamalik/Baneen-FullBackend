import Joi from 'joi';

// Normalize phone from form data or JSON: trim, strip non-digits, accept 10 or 11 digits, return 11-digit string
const normalizePhone = (value, helpers) => {
  if (value == null || value === '') return helpers.error('any.required');
  const digits = String(value).trim().replace(/\D/g, '');
  if (!/^0?[0-9]{10}$/.test(digits)) return helpers.error('any.invalid');
  return digits.length === 10 ? '0' + digits : digits;
};

export const registerDriverSchema = Joi.object({
  name: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  phone: Joi.any().required().custom(normalizePhone),
  alternatePhone: Joi.any().optional().allow('', null).custom((value, helpers) => {
    if (value == null || value === '') return value;
    return normalizePhone(value, helpers);
  }),
  cnic: Joi.string().pattern(/^[0-9]{13}$/).required(),
  password: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({ 'any.only': 'Password and confirm password must match' }),
  vehicleType: Joi.string().valid('car', 'bike').required(),
  vehicleName: Joi.string().min(2).required(),
  owner: Joi.string().min(3).required(),
  address: Joi.string().min(10).required(),
});
