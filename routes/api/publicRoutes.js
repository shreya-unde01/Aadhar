const express = require('express');
const router = express.Router();
const { getPublicStats } = require('../../utils/publicStats');
const asyncHandler = require('../../utils/asyncHandler');

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await getPublicStats();
    res.json(stats);
  })
);

module.exports = router;
