const { body, validationResult } = require('express-validator');

const signupValidators = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phone')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
  body('role')
    .isIn(['donor', 'volunteer', 'elderly'])
    .withMessage('Invalid role selected'),
  body('partnerName')
    .if(body('role').equals('elderly'))
    .trim()
    .notEmpty()
    .withMessage('Partner name is required')
    .isLength({ max: 100 }),
  body('homeAddress')
    .if(body('role').equals('elderly'))
    .trim()
    .notEmpty()
    .withMessage('Home address is required')
    .isLength({ max: 500 }),
  body('donorType')
    .if(body('role').equals('donor'))
    .optional()
    .isIn(['individual', 'hotel', 'business']),
];

const loginValidators = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const DONATION_TYPES = ['food'];

const donationValidators = [
  body('type').isIn(DONATION_TYPES).withMessage('Please choose a valid donation type'),
  body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be a positive number'),
  body('unit').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('address').trim().notEmpty().withMessage('Pickup address is required'),
  body('lat').optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }),
  body('lng').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  body('date').isISO8601().withMessage('Please choose a pickup date'),
  body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Please choose a start time'),
  body('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Please choose an end time'),
  body('expiryDate').optional({ checkFalsy: true }).isISO8601(),
  body('urgent').optional().toBoolean(),
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const isApi = req.originalUrl.startsWith('/api/');
    const messages = errors.array().map((e) => e.msg);
    if (isApi) {
      return res.status(400).json({ success: false, message: messages[0], errors: messages });
    }
    req.validationErrors = messages;
  }
  return next();
}

module.exports = { signupValidators, loginValidators, donationValidators, handleValidationErrors };
