const Donation = require('../models/Donation');
const Task = require('../models/Task');
const Report = require('../models/Report');
const Feedback = require('../models/Feedback');
const EmergencyAlert = require('../models/EmergencyAlert');
const { Volunteer, NGOAdmin } = require('../models/User');
const { haversineDistanceKm } = require('../utils/geo');
const { getDistanceMatrix } = require('../utils/distanceMatrix');
const { updateDonationStatus } = require('../utils/donationStatusService');
const { emitTaskAssigned, emitEmergencyAlert } = require('../sockets');

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
exports.getOverview = async (req, res) => {
  const ngoId = req.user._id;
  const [totalDonations, activeVolunteers, pendingPickups, completedDeliveries, pendingApprovals, activeAlerts] =
    await Promise.all([
      Donation.countDocuments({ ngoId }),
      Volunteer.countDocuments({ ngoId, isApproved: true, isActive: true }),
      Donation.countDocuments({ ngoId, status: { $in: ['pending', 'assigned'] } }),
      Donation.countDocuments({ ngoId, status: 'delivered' }),
      Volunteer.countDocuments({ ngoId, isApproved: false, isActive: true }),
      EmergencyAlert.countDocuments({ isActive: true }),
    ]);

  const recentDonations = await Donation.find({ ngoId }).sort({ createdAt: -1 }).limit(6).populate('donorId', 'name');

  res.render('ngo/dashboard', {
    title: 'Lions Club Admin Dashboard',
    stats: { totalDonations, activeVolunteers, pendingPickups, completedDeliveries, pendingApprovals, activeAlerts },
    recentDonations,
  });
};

// ---------------------------------------------------------------------------
// Manage Donations
// ---------------------------------------------------------------------------
exports.getDonationsList = async (req, res) => {
  const { status, urgent, type } = req.query;
  const filter = { ngoId: req.user._id };
  if (status && Donation.STATUSES.includes(status)) filter.status = status;
  if (urgent === '1') filter.urgent = true;
  if (type && Donation.TYPES.includes(type)) filter.type = type;

  const donations = await Donation.find(filter).sort({ createdAt: 1 }).populate('donorId', 'name');

  res.render('ngo/donations-list', {
    title: 'Manage Donations',
    donations,
    statuses: Donation.STATUSES,
    types: Donation.TYPES,
    query: req.query,
  });
};

exports.postToggleUrgent = async (req, res) => {
  const donation = await Donation.findById(req.params.id);
  if (!donation) return res.status(404).render('error', { title: 'Not found', message: 'Donation not found.' });
  donation.urgent = !donation.urgent;
  await donation.save();
  res.redirect('/admin/donations');
};

exports.getAssignDonation = async (req, res) => {
  const donation = await Donation.findById(req.params.id).populate('donorId', 'name phone');
  if (!donation) return res.status(404).render('error', { title: 'Not found', message: 'Donation not found.' });

  const volunteers = await Volunteer.find({ ngoId: req.user._id, isApproved: true, isActive: true, isAvailable: true });

  const hasCoords = donation.pickupLocation.lat != null && donation.pickupLocation.lng != null;
  const volunteersWithCoords = volunteers.filter((v) => v.location.lat != null && v.location.lng != null);

  let rankingMethod = 'none';
  let ranked = volunteers.map((v) => ({ volunteer: v, distanceKm: null, durationMin: null }));

  if (hasCoords && volunteersWithCoords.length > 0) {
    // Try real road distance/travel time first (project decision: Distance
    // Matrix over plain Haversine — see Phase 5 planning).
    const matrix = await getDistanceMatrix(
      donation.pickupLocation,
      volunteersWithCoords.map((v) => v.location)
    );

    if (matrix) {
      rankingMethod = 'distance-matrix';
      const byId = new Map();
      volunteersWithCoords.forEach((v, i) => byId.set(v._id.toString(), matrix[i]));
      ranked = volunteers.map((v) => {
        const m = byId.get(v._id.toString());
        return { volunteer: v, distanceKm: m ? m.distanceKm : null, durationMin: m ? m.durationMin : null };
      });
    } else {
      // API not configured, or the request failed — fall back to straight-line distance.
      rankingMethod = 'haversine';
      ranked = volunteers.map((v) => {
        let distanceKm = null;
        if (v.location.lat != null && v.location.lng != null) {
          distanceKm = haversineDistanceKm(
            donation.pickupLocation.lat,
            donation.pickupLocation.lng,
            v.location.lat,
            v.location.lng
          );
        }
        return { volunteer: v, distanceKm, durationMin: null };
      });
    }
  }

  ranked.sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return a.volunteer.name.localeCompare(b.volunteer.name);
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });

  const ngo = await NGOAdmin.findById(req.user._id);

  res.render('ngo/donation-assign', {
    title: `Assign — ${donation.donationCode}`,
    donation,
    ranked,
    hasCoords,
    rankingMethod,
    defaultDeliveryAddress: ngo?.organizationAddress || '',
    errors: null,
  });
};

exports.postAssignVolunteer = async (req, res) => {
  const donation = await Donation.findById(req.params.id);
  if (!donation) return res.status(404).render('error', { title: 'Not found', message: 'Donation not found.' });

  const { volunteerId, deliveryAddress, deliveryLat, deliveryLng } = req.body;
  const volunteer = await Volunteer.findOne({ _id: volunteerId, ngoId: req.user._id, isApproved: true, isActive: true });

  if (!volunteer || !deliveryAddress) {
    return res.redirect(`/admin/donations/${donation._id}/assign`);
  }

  const task = await Task.createForDonation({
    donation,
    volunteerId: volunteer._id,
    ngoId: req.user._id,
    deliveryAddress,
    deliveryLat: deliveryLat ? Number(deliveryLat) : null,
    deliveryLng: deliveryLng ? Number(deliveryLng) : null,
  });

  donation.assignedVolunteerId = volunteer._id;
  donation.assignedByNgoId = req.user._id;
  await updateDonationStatus(donation, 'assigned', `Assigned to ${volunteer.name}`);

  emitTaskAssigned(task, volunteer);

  res.redirect('/admin/donations?status=assigned');
};

// ---------------------------------------------------------------------------
// Volunteer Management
// ---------------------------------------------------------------------------
exports.getVolunteersList = async (req, res) => {
  const { tab = 'pending' } = req.query;
  let filter = { ngoId: req.user._id };
  if (tab === 'pending') filter.isApproved = false;
  else if (tab === 'active') filter.isApproved = true;
  else if (tab === 'inactive') filter.isActive = false;

  if (tab === 'pending' || tab === 'active') filter.isActive = true;

  const volunteers = await Volunteer.find(filter).sort({ createdAt: -1 });

  res.render('ngo/volunteers-list', { title: 'Manage Volunteers', volunteers, activeTab: tab });
};

exports.postApproveVolunteer = async (req, res) => {
  await Volunteer.findOneAndUpdate({ _id: req.params.id, ngoId: req.user._id }, { isApproved: true, isActive: true });
  res.redirect('/admin/volunteers?tab=pending');
};

exports.postRejectVolunteer = async (req, res) => {
  await Volunteer.findOneAndUpdate({ _id: req.params.id, ngoId: req.user._id }, { isApproved: false, isActive: false });
  res.redirect('/admin/volunteers?tab=pending');
};

exports.postDeactivateVolunteer = async (req, res) => {
  await Volunteer.findOneAndUpdate({ _id: req.params.id, ngoId: req.user._id }, { isActive: false });
  res.redirect('/admin/volunteers?tab=active');
};

exports.postReactivateVolunteer = async (req, res) => {
  await Volunteer.findOneAndUpdate({ _id: req.params.id, ngoId: req.user._id }, { isActive: true });
  res.redirect('/admin/volunteers?tab=inactive');
};

exports.getVolunteerDetail = async (req, res) => {
  const volunteer = await Volunteer.findOne({ _id: req.params.id, ngoId: req.user._id });
  if (!volunteer) return res.status(404).render('error', { title: 'Not found', message: 'Volunteer not found.' });

  const tasks = await Task.find({ volunteerId: volunteer._id }).sort({ createdAt: -1 }).populate('donationId', 'donationCode type quantity');
  const feedback = await Feedback.find({ submittedByVolunteerId: volunteer._id }).sort({ createdAt: -1 }).limit(10);

  res.render('ngo/volunteer-detail', { title: volunteer.name, volunteer, tasks, feedback });
};

// ---------------------------------------------------------------------------
// Logistics — scheduled pickups with a plain Google Maps directions link
// (no API key needed for this URL scheme; the embedded map view arrives in Phase 5)
// ---------------------------------------------------------------------------
exports.getLogistics = async (req, res) => {
  const tasks = await Task.find({ ngoId: req.user._id, status: { $in: ['assigned', 'accepted', 'picked'] } })
    .sort({ createdAt: -1 })
    .populate('donationId', 'donationCode type quantity timeSlot urgent')
    .populate('volunteerId', 'name phone');

  res.render('ngo/logistics', { title: 'Logistics', tasks });
};

// ---------------------------------------------------------------------------
// Transparency — admin-wide donation tracking lookup by code
// ---------------------------------------------------------------------------
exports.getTrack = async (req, res) => {
  const { code } = req.query;
  let donation = null;
  let notFound = false;

  if (code) {
    donation = await Donation.findOne({ donationCode: code.trim().toUpperCase(), ngoId: req.user._id })
      .populate('donorId', 'name phone')
      .populate('assignedVolunteerId', 'name phone');
    if (!donation) notFound = true;
  }

  res.render('ngo/track', { title: 'Track a Donation', donation, code: code || '', notFound });
};

// ---------------------------------------------------------------------------
// Reports — reads the trigger-maintained Report collection, no live aggregation
// ---------------------------------------------------------------------------
exports.getReports = async (req, res) => {
  const last30 = await Report.find({}).sort({ date: -1 }).limit(30);

  const totals = last30.reduce(
    (acc, r) => {
      acc.donationsDelivered += r.donationsDelivered;
      acc.mealsDelivered += r.mealsDelivered;
      acc.itemsDistributed += r.itemsDistributed;
      acc.moneyRaised += r.moneyRaised;
      acc.skillHoursOffered += r.skillHoursOffered;
      acc.wasteReducedKg += r.wasteReducedKg;
      return acc;
    },
    { donationsDelivered: 0, mealsDelivered: 0, itemsDistributed: 0, moneyRaised: 0, skillHoursOffered: 0, wasteReducedKg: 0 }
  );

  res.render('ngo/reports', { title: 'Reports', last30, totals });
};

// ---------------------------------------------------------------------------
// Emergency Mode
// ---------------------------------------------------------------------------
exports.getEmergency = async (req, res) => {
  const alerts = await EmergencyAlert.find({}).sort({ isActive: -1, createdAt: -1 }).populate('createdBy', 'name');
  res.render('ngo/emergency', { title: 'Emergency Mode', alerts, errors: null, notified: req.query.notified });
};

exports.postEmergency = async (req, res) => {
  const { title, message, address, lat, lng, radiusKm } = req.body;

  if (!title || !lat || !lng) {
    const alerts = await EmergencyAlert.find({}).sort({ isActive: -1, createdAt: -1 }).populate('createdBy', 'name');
    return res.status(400).render('ngo/emergency', {
      title: 'Emergency Mode',
      alerts,
      errors: ['Title and a location (latitude/longitude) are required.'],
    });
  }

  const alert = await EmergencyAlert.create({
    title,
    message: message || '',
    createdBy: req.user._id,
    area: { address: address || '', lat: Number(lat), lng: Number(lng), radiusKm: radiusKm ? Number(radiusKm) : 5 },
  });

  // Push to volunteers actually within range right now — computed here rather
  // than stored as a flag, so it's always accurate to current volunteer locations.
  const candidates = await Volunteer.find({
    ngoId: req.user._id,
    isApproved: true,
    isActive: true,
    'location.lat': { $ne: null },
    'location.lng': { $ne: null },
  }).select('_id location');

  const nearbyIds = candidates
    .filter((v) => haversineDistanceKm(alert.area.lat, alert.area.lng, v.location.lat, v.location.lng) <= alert.area.radiusKm)
    .map((v) => v._id.toString());

  emitEmergencyAlert(alert, nearbyIds);

  res.redirect(`/admin/emergency?notified=${nearbyIds.length}`);
};

exports.postResolveEmergency = async (req, res) => {
  await EmergencyAlert.findByIdAndUpdate(req.params.id, { isActive: false, resolvedAt: new Date() });
  res.redirect('/admin/emergency');
};
