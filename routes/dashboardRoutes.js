const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');

router.get('/volunteer/pending-approval', requireRole('volunteer'), (req, res) => {
  res.render('volunteer/pending-approval', { title: 'Pending Approval' });
});

module.exports = router;
