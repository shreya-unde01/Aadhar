const express = require('express');
const router = express.Router();

const donorController = require('../controllers/donorController');
const { requireRole } = require('../middleware/auth');
const { donationValidators, handleValidationErrors } = require('../middleware/validators');
const asyncHandler = require('../utils/asyncHandler');

router.use(requireRole('donor'));

router.get('/dashboard', asyncHandler(donorController.getDashboard));

router.get('/donations/new', donorController.getNewDonationForm);
router.post('/donations', donationValidators, handleValidationErrors, asyncHandler(donorController.postDonation));

router.get('/donations/bulk-new', donorController.getBulkForm);
router.post('/donations/bulk', asyncHandler(donorController.postBulkDonation));

router.get('/donations', asyncHandler(donorController.getDonationsList));
router.get('/donations/:id', asyncHandler(donorController.getDonationDetail));

router.get('/leaderboard', asyncHandler(donorController.getLeaderboard));
router.get('/feedback', asyncHandler(donorController.getFeedback));

module.exports = router;
