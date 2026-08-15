const Donation = require('../models/Donation');
const Feedback = require('../models/Feedback');
const { Donor } = require('../models/User');
const { getLionsClubAdmin } = require('../utils/lionsClub');
const { BADGE_DEFINITIONS } = require('../utils/badgeEngine');
const { emitNewDonation } = require('../sockets');
const QRCode = require('qrcode');
const crypto = require('crypto');

const DONATION_TYPES = Donation.TYPES;
const pickupDateSort = { 'timeSlot.date': 1, createdAt: 1 };

async function buildLionsClubPaymentData() {
  const lionsClub = await getLionsClubAdmin('_id organizationName upiId');
  if (!lionsClub) throw new Error('Lions Club administration has not been configured yet.');

  const upiUri = lionsClub.upiId
    ? `upi://pay?pa=${encodeURIComponent(lionsClub.upiId)}&pn=${encodeURIComponent(lionsClub.organizationName || 'Lions Club')}&cu=INR`
    : '';
  const lionsClubPayment = {
    name: lionsClub.organizationName || 'Lions Club',
    upiId: lionsClub.upiId || '',
    upiUri,
    qrDataUrl: upiUri ? await QRCode.toDataURL(upiUri) : '',
  };

  return { lionsClub, lionsClubPayment };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
exports.getDashboard = async (req, res) => {
  const donorId = req.user._id;

  const [donor, recentDonations, statusCounts] = await Promise.all([
    Donor.findById(donorId).populate('badges.badgeId'),
    Donation.find({ donorId }).sort(pickupDateSort).limit(5),
    Donation.aggregate([
      { $match: { donorId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const counts = { pending: 0, assigned: 0, accepted: 0, pickup_reached: 0, picked: 0, in_transit: 0, delivered: 0, cancelled: 0 };
  statusCounts.forEach((row) => { counts[row._id] = row.count; });

  // Leaderboard rank — how many donors currently outscore this one.
  const rank = (await Donor.countDocuments({ leaderboardScore: { $gt: donor.leaderboardScore } })) + 1;

  res.render('donor/dashboard', {
    title: 'Donor Dashboard',
    donor,
    recentDonations,
    counts,
    rank,
    totalDonations: donor.totalDonations,
  });
};

// ---------------------------------------------------------------------------
// Add single donation
// ---------------------------------------------------------------------------
exports.getNewDonationForm = async (req, res) => {
  const { lionsClub, lionsClubPayment } = await buildLionsClubPaymentData();

  res.render('donor/donation-form', {
    title: 'Add Donation',
    errors: null,
    formData: {},
    donationTypes: DONATION_TYPES,
    lionsClub,
    lionsClubPayment,
  });
};

exports.postDonation = async (req, res) => {
  const { lionsClub, lionsClubPayment } = await buildLionsClubPaymentData();

  if (req.validationErrors) {
    return res.status(400).render('donor/donation-form', {
      title: 'Add Donation',
      errors: req.validationErrors,
      formData: req.body,
      donationTypes: DONATION_TYPES,
      lionsClub,
      lionsClubPayment,
    });
  }

  try {
    const b = req.body;
    const donation = await Donation.create({
      donorId: req.user._id,
      ngoId: lionsClub._id,
      type: 'food',
      quantity: Number(b.quantity),
      unit: b.unit || null,
      description: b.description || '',
      pickupLocation: { address: b.address, lat: b.lat ? Number(b.lat) : null, lng: b.lng ? Number(b.lng) : null },
      timeSlot: { date: b.date, startTime: b.startTime, endTime: b.endTime },
      expiryDate: b.expiryDate || null,
    });

    emitNewDonation(donation);
    res.redirect('/?donation=success');
  } catch (err) {
    console.error('[donor] create donation error:', err);
    res.status(500).render('donor/donation-form', {
      title: 'Add Donation',
      errors: [err.message || 'Something went wrong while saving your donation. Please try again.'],
      formData: req.body,
      donationTypes: DONATION_TYPES,
      lionsClub,
      lionsClubPayment,
    });
  }
};

// ---------------------------------------------------------------------------
// Bulk donation (hotels/events — multiple items, one shared pickup)
// ---------------------------------------------------------------------------
exports.getBulkForm = (req, res) => {
  res.render('donor/donation-bulk-form', {
    title: 'Bulk Donation',
    errors: null,
    donationTypes: DONATION_TYPES,
  });
};

exports.postBulkDonation = async (req, res) => {
  try {
    const { address, lat, lng, date, startTime, endTime, itemsJson } = req.body;
    let items;
    try {
      items = JSON.parse(itemsJson);
    } catch {
      throw new Error('Item list was not formatted correctly.');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Add at least one item to your bulk donation.');
    }
    if (!address || !date || !startTime || !endTime) {
      throw new Error('Pickup address, date, and time slot are required.');
    }

    const lionsClub = await getLionsClubAdmin('_id');
    if (!lionsClub) throw new Error('Lions Club administration has not been configured yet.');

    const bulkGroupId = crypto.randomUUID();
    const shared = {
      donorId: req.user._id,
      ngoId: lionsClub._id,
      pickupLocation: { address, lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null },
      timeSlot: { date, startTime, endTime },
      bulkGroupId,
    };

    const docs = [];
    for (const item of items) {
      if (item.type && item.type !== 'food') throw new Error('Only food donations are accepted.');
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) throw new Error('Invalid quantity for a food item.');

      docs.push({
        ...shared,
        type: 'food',
        quantity: qty,
        unit: item.unit || null,
        description: item.description || '',
        expiryDate: item.expiryDate || null,
      });
    }

    // Sequential create (not insertMany) so each doc runs the pre-validate
    // donationCode generator and the post-save badge/leaderboard trigger.
    const created = [];
    for (const doc of docs) {
      const donation = await Donation.create(doc);
      created.push(donation);
      emitNewDonation(donation);
    }

    res.redirect('/?donation=success');
  } catch (err) {
    console.error('[donor] bulk donation error:', err);
    res.status(400).render('donor/donation-bulk-form', {
      title: 'Bulk Donation',
      errors: [err.message || 'Something went wrong. Please review your items and try again.'],
      donationTypes: DONATION_TYPES,
    });
  }
};

// ---------------------------------------------------------------------------
// Track donations (list + filter)
// ---------------------------------------------------------------------------
exports.getDonationsList = async (req, res) => {
  const { status, bulkGroupId } = req.query;
  const filter = { donorId: req.user._id };
  if (status && Donation.STATUSES.includes(status)) filter.status = status;
  if (bulkGroupId) filter.bulkGroupId = bulkGroupId;

  const donations = await Donation.find(filter).sort(pickupDateSort);

  res.render('donor/donations-list', {
    title: 'My Donations',
    donations,
    activeStatus: status || 'all',
    statuses: Donation.STATUSES,
    justCreated: req.query.created || null,
  });
};

// ---------------------------------------------------------------------------
// Single donation detail / tracking pipeline
// ---------------------------------------------------------------------------
exports.getDonationDetail = async (req, res) => {
  const donation = await Donation.findOne({ _id: req.params.id, donorId: req.user._id })
    .populate('assignedVolunteerId', 'name phone avgRating');

  if (!donation) {
    return res.status(404).render('error', { title: 'Not found', message: "We couldn't find that donation." });
  }

  const feedback = await Feedback.findOne({ donationId: donation._id });

  res.render('donor/donation-detail', {
    title: `Donation ${donation.donationCode}`,
    donation,
    feedback,
    justCreated: req.query.created === '1',
  });
};

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
exports.getLeaderboard = async (req, res) => {
  const topDonors = await Donor.find({})
    .sort({ leaderboardScore: -1 })
    .limit(20)
    .populate('badges.badgeId')
    .select('name donorType organizationName totalDonations leaderboardScore badges');

  res.render('donor/leaderboard', {
    title: 'Leaderboard',
    topDonors,
    currentUserId: req.user._id.toString(),
    allBadges: BADGE_DEFINITIONS,
  });
};

// ---------------------------------------------------------------------------
// Feedback received on this donor's donations
// ---------------------------------------------------------------------------
exports.getFeedback = async (req, res) => {
  const donations = await Donation.find({ donorId: req.user._id }).select('_id');
  const donationIds = donations.map((d) => d._id);

  const feedbackList = await Feedback.find({ donationId: { $in: donationIds } })
    .populate('donationId', 'donationCode type')
    .sort({ createdAt: -1 });

  res.render('donor/feedback', { title: 'Feedback Received', feedbackList });
};
