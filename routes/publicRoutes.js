const express = require('express');
const router = express.Router();
const { getPublicStats } = require('../utils/publicStats');
const asyncHandler = require('../utils/asyncHandler');

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const stats = await getPublicStats();
    res.render('public/home', { title: 'Home', stats });
  })
);

router.get(
  '/impact',
  asyncHandler(async (req, res) => {
    const stats = await getPublicStats();
    res.render('public/impact', { title: 'Our Impact', stats });
  })
);

module.exports = router;
