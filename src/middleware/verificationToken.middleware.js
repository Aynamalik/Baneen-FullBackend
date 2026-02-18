/**
 * Copies verificationToken from cookie to req.body if not already present.
 * Allows verify-otp endpoints to accept token from cookie (set during registration).
 */
export const injectVerificationTokenFromCookie = (req, res, next) => {
  if (!req.body) req.body = {};
  if (!req.body.verificationToken && req.cookies?.verificationToken) {
    req.body.verificationToken = req.cookies.verificationToken;
  }
  next();
};
