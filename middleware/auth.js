const { verifyToken, COOKIE_NAME } = require('../utils/jwt');
const { User } = require('../models/User');
const { LIONS_CLUB_ADMIN } = require('../utils/lionsClub');

/**
 * Verifies the JWT from the httpOnly cookie and attaches the full user
 * document (minus passwordHash) to req.user. If no valid token is present,
 * req.user stays undefined and the request continues — individual routes
 * decide whether that's acceptable via requireAuth/requireRole.
 */
async function attachUser(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next();

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (user && user.isActive) {
      req.user = user;
      res.locals.currentUser = user; // available in every EJS view
    }
    return next();
  } catch (err) {
    // Invalid/expired token — treat as logged out, don't crash the request
    res.clearCookie(COOKIE_NAME);
    return next();
  }
}

/** Blocks the request unless a valid logged-in user is attached. */
function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Please log in to continue.' });
    }
    return res.redirect('/login');
  }
  return next();
}

/**
 * Restricts a route to one or more roles, e.g. requireRole('ngo_admin')
 * or requireRole('ngo_admin', 'volunteer').
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Please log in to continue.' });
      }
      return res.redirect('/login');
    }
    const isOnlyPermittedNgoAdmin =
      req.user.role !== 'ngo_admin' || req.user.email === LIONS_CLUB_ADMIN.email;

    if (!roles.includes(req.user.role) || !isOnlyPermittedNgoAdmin) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ success: false, message: 'You do not have access to this resource.' });
      }
      return res.status(403).render('error', {
        title: 'Access denied',
        message: "You don't have permission to view this page.",
      });
    }
    return next();
  };
}

module.exports = { attachUser, requireAuth, requireRole };
