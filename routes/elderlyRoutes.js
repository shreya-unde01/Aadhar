const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const elderlyController = require('../controllers/elderlyController');

router.use(requireRole('elderly'));

router.get('/dashboard', asyncHandler(elderlyController.getDashboard));
router.get('/requests/new', elderlyController.getRequestForm);
router.post('/requests', asyncHandler(elderlyController.postRequest));
router.get('/requests/:id', asyncHandler(elderlyController.getRequestDetail));

module.exports = router;
