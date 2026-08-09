const express = require('express');
const router = express.Router();

const volunteerController = require('../controllers/volunteerController');
const { requireRole } = require('../middleware/auth');
const { uploadDelivery } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');

router.use(requireRole('volunteer'));

// Approved volunteers only past this point — unapproved ones get redirected
// to the pending-approval page (mirrors the check already used for /volunteer/dashboard).
router.use((req, res, next) => {
  if (!req.user.isApproved) return res.redirect('/volunteer/pending-approval');
  next();
});

router.get('/dashboard', asyncHandler(volunteerController.getDashboard));

router.post('/tasks/:id/accept', asyncHandler(volunteerController.postAcceptTask));
router.post('/tasks/:id/reject', asyncHandler(volunteerController.postRejectTask));
router.post('/tasks/:id/picked', asyncHandler(volunteerController.postMarkPicked));

router.get('/tasks/:id/deliver', asyncHandler(volunteerController.getDeliverForm));
router.post('/tasks/:id/deliver', uploadDelivery, asyncHandler(volunteerController.postDeliver));

router.get('/feedback', asyncHandler(volunteerController.getMyFeedback));

module.exports = router;
