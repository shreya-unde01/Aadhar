const express = require('express');
const router = express.Router();

const ngoController = require('../controllers/ngoController');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(requireRole('ngo_admin'));

router.get('/dashboard', asyncHandler(ngoController.getOverview));

// Donations
router.get('/donations', asyncHandler(ngoController.getDonationsList));
router.post('/donations/:id/toggle-urgent', asyncHandler(ngoController.postToggleUrgent));
router.get('/donations/:id/assign', asyncHandler(ngoController.getAssignDonation));
router.post('/donations/:id/assign', asyncHandler(ngoController.postAssignVolunteer));

// Volunteers
router.get('/volunteers', asyncHandler(ngoController.getVolunteersList));
router.get('/volunteers/:id', asyncHandler(ngoController.getVolunteerDetail));
router.post('/volunteers/:id/approve', asyncHandler(ngoController.postApproveVolunteer));
router.post('/volunteers/:id/reject', asyncHandler(ngoController.postRejectVolunteer));
router.post('/volunteers/:id/deactivate', asyncHandler(ngoController.postDeactivateVolunteer));
router.post('/volunteers/:id/reactivate', asyncHandler(ngoController.postReactivateVolunteer));

// Logistics
router.get('/logistics', asyncHandler(ngoController.getLogistics));

// Transparency — tracking lookup
router.get('/track', asyncHandler(ngoController.getTrack));

// Reports
router.get('/reports', asyncHandler(ngoController.getReports));

// Emergency mode
router.get('/emergency', asyncHandler(ngoController.getEmergency));
router.post('/emergency', asyncHandler(ngoController.postEmergency));
router.post('/emergency/:id/resolve', asyncHandler(ngoController.postResolveEmergency));

module.exports = router;
