
export const injectVerificationTokenFromCookie = (req, res, next) => {
  if (!req.body) req.body = {};
  if (!req.body.verificationToken && req.cookies?.verificationToken) {
    req.body.verificationToken = req.cookies.verificationToken;
  }
  next();
};

/** Injects reset identifier (email/phone) from cookie for forgot-password OTP verification */
export const injectResetIdentifierFromCookie = (req, res, next) => {
  if (!req.body) req.body = {};
  if (!req.body.identifier && req.cookies?.resetIdentifier) {
    req.body.identifier = req.cookies.resetIdentifier;
  }
  next();
};
