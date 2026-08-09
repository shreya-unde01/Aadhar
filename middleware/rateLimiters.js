const rateLimit = require('express-rate-limit');

// Applies to /login and /signup style endpoints. Deliberately generous for
// local dev/testing but still meaningful.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts from this device. Please wait a few minutes and try again.',
  },
});

module.exports = { authLimiter };
