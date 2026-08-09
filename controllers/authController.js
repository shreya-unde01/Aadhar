const { User, Donor, Volunteer } = require('../models/User');
const { signToken, COOKIE_NAME, getCookieOptions } = require('../utils/jwt');
const verifyRecaptcha = require('../utils/verifyRecaptcha');
const { LIONS_CLUB_ADMIN, getLionsClubAdmin } = require('../utils/lionsClub');

async function renderSignupWithErrors(req, res, messages) {
  return res.status(400).render('auth/signup', {
    title: 'Sign Up',
    errors: messages,
    formData: req.body,
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
  });
}

function renderLoginWithErrors(req, res, messages) {
  const adminOnly = req.originalUrl.startsWith('/admin/login');
  return res.status(400).render('auth/login', {
    title: adminOnly ? 'Lions Club Admin Login' : 'Log In',
    errors: messages,
    formData: req.body,
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    adminOnly,
    loginAction: adminOnly ? '/admin/login' : '/login',
  });
}

// GET /signup
exports.getSignup = async (req, res) => {
  res.render('auth/signup', {
    title: 'Sign Up',
    errors: null,
    formData: {},
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
  });
};

// GET /login
exports.getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Log In',
    errors: null,
    formData: {},
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    adminOnly: false,
    loginAction: '/login',
  });
};

// Lions Club's management account has a dedicated entry point. Donors and
// volunteers continue to use the regular login.
exports.getAdminLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Lions Club Admin Login',
    errors: null,
    formData: {},
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    adminOnly: true,
    loginAction: '/admin/login',
  });
};

// POST /signup
exports.postSignup = async (req, res) => {
  const isApi = req.originalUrl.startsWith('/api/');

  if (req.validationErrors) {
    return renderSignupWithErrors(req, res, req.validationErrors);
  }

  try {
    const { name, email, phone, password, role, donorType, organizationName, skills } = req.body;

    const captchaOk = await verifyRecaptcha(req.body['g-recaptcha-response']);
    if (!captchaOk) {
      const msg = 'CAPTCHA verification failed. Please try again.';
      return isApi
        ? res.status(400).json({ success: false, message: msg })
        : renderSignupWithErrors(req, res, [msg]);
    }

    const existing = await User.findOne({ email });
    if (existing) {
      const msg = 'An account with this email already exists.';
      return isApi
        ? res.status(409).json({ success: false, message: msg })
        : renderSignupWithErrors(req, res, [msg]);
    }

    const passwordHash = await User.hashPassword(password);

    let user;
    if (role === 'donor') {
      user = await Donor.create({
        name,
        email,
        phone,
        passwordHash,
        donorType: donorType || 'individual',
        organizationName: donorType && donorType !== 'individual' ? organizationName : null,
      });
    } else if (role === 'volunteer') {
      const lionsClubAdmin = await getLionsClubAdmin('_id');
      if (!lionsClubAdmin) {
        const msg = 'Lions Club administration has not been configured yet.';
        return isApi
          ? res.status(400).json({ success: false, message: msg })
          : renderSignupWithErrors(req, res, [msg]);
      }

      user = await Volunteer.create({
        name,
        email,
        phone,
        passwordHash,
        ngoId: lionsClubAdmin._id,
        skills: skills ? String(skills).split(',').map((s) => s.trim()).filter(Boolean) : [],
        isApproved: false, // requires NGO admin approval before taking tasks
      });
    } else {
      const msg = 'Invalid role selected.';
      return isApi
        ? res.status(400).json({ success: false, message: msg })
        : renderSignupWithErrors(req, res, [msg]);
    }

    const token = signToken({ id: user._id, role: user.role });
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    if (role === 'volunteer') {
      const { emitNewVolunteerSignup } = require('../sockets');
      emitNewVolunteerSignup(user);
    }

    if (isApi) {
      return res.status(201).json({ success: true, user: { id: user._id, name: user.name, role: user.role } });
    }

    if (role === 'volunteer') {
      return res.redirect('/volunteer/pending-approval');
    }
    return res.redirect(`/${role === 'ngo_admin' ? 'admin' : role}/dashboard`);
  } catch (err) {
    console.error('[auth] signup error:', err);
    const msg = 'Something went wrong while creating your account. Please try again.';
    return isApi
      ? res.status(500).json({ success: false, message: msg })
      : renderSignupWithErrors(req, res, [msg]);
  }
};

// POST /login
exports.postLogin = async (req, res) => {
  const isApi = req.originalUrl.startsWith('/api/');
  const adminOnly = req.originalUrl.startsWith('/admin/login');

  if (req.validationErrors) {
    return renderLoginWithErrors(req, res, req.validationErrors);
  }

  try {
    const { email, password } = req.body;

    const captchaOk = await verifyRecaptcha(req.body['g-recaptcha-response']);
    if (!captchaOk) {
      const msg = 'CAPTCHA verification failed. Please try again.';
      return isApi
        ? res.status(400).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    // The admin route is deliberately not a general NGO-admin login. There is
    // one provisioned Lions Club account and its credentials are fixed.
    if (adminOnly && (email !== LIONS_CLUB_ADMIN.email || password !== LIONS_CLUB_ADMIN.password)) {
      const msg = 'Invalid email or password.';
      return isApi
        ? res.status(401).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    const user = adminOnly
      ? await getLionsClubAdmin('+passwordHash')
      : await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.isActive) {
      const msg = 'Invalid email or password.';
      return isApi
        ? res.status(401).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      const msg = 'Invalid email or password.';
      return isApi
        ? res.status(401).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    if (adminOnly && user.role !== 'ngo_admin') {
      const msg = 'This login is reserved for the Lions Club administrator.';
      return isApi
        ? res.status(403).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    if (!adminOnly && user.role === 'ngo_admin') {
      const msg = 'Please use the Lions Club Admin Login to access this account.';
      return isApi
        ? res.status(403).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    const token = signToken({ id: user._id, role: user.role });
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    if (isApi) {
      return res.json({ success: true, user: { id: user._id, name: user.name, role: user.role } });
    }

    if (user.role === 'volunteer' && !user.isApproved) {
      return res.redirect('/volunteer/pending-approval');
    }
    return res.redirect(`/${user.role === 'ngo_admin' ? 'admin' : user.role}/dashboard`);
  } catch (err) {
    console.error('[auth] login error:', err);
    const msg = 'Something went wrong while logging in. Please try again.';
    return isApi
      ? res.status(500).json({ success: false, message: msg })
      : renderLoginWithErrors(req, res, [msg]);
  }
};

// POST /logout
exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME);
  const isApi = req.originalUrl.startsWith('/api/');
  if (isApi) return res.json({ success: true });
  return res.redirect('/login');
};
