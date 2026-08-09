const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { signupValidators, loginValidators, handleValidationErrors } = require('../middleware/validators');
const { authLimiter } = require('../middleware/rateLimiters');

router.get('/signup', authController.getSignup);
router.post('/signup', authLimiter, signupValidators, handleValidationErrors, authController.postSignup);

router.get('/login', authController.getLogin);
router.post('/login', authLimiter, loginValidators, handleValidationErrors, authController.postLogin);
router.get('/admin/login', authController.getAdminLogin);
router.post('/admin/login', authLimiter, loginValidators, handleValidationErrors, authController.postLogin);

router.post('/logout', authController.logout);
router.get('/logout', authController.logout); // convenience for a simple <a> link

module.exports = router;
