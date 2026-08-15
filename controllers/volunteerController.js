const Task = require('../models/Task');
const Donation = require('../models/Donation');
const Feedback = require('../models/Feedback');
const EmergencyAlert = require('../models/EmergencyAlert');
const FoodRequest = require('../models/FoodRequest');
const { Volunteer } = require('../models/User');
const { haversineDistanceKm } = require('../utils/geo');
const { updateDonationStatus } = require('../utils/donationStatusService');
const { updateFoodRequestStatus } = require('../utils/foodRequestStatusService');
const { emitVolunteerTaskUpdate } = require('../sockets');

// ---------------------------------------------------------------------------
// Dashboard — assigned tasks + emergency alerts in range
// ---------------------------------------------------------------------------
exports.getDashboard = async (req, res) => {
  const tasks = await Task.find({
    volunteerId: req.user._id,
    status: { $in: ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] },
  })
    .sort({ createdAt: -1 })
    .populate('donationId')
    .populate('foodRequestId')
    .populate('beneficiaryId', 'name partnerName phone homeAddress');

  let nearbyAlerts = [];
  const { lat, lng } = req.user.location || {};
  if (lat != null && lng != null) {
    const activeAlerts = await EmergencyAlert.find({ isActive: true });
    nearbyAlerts = activeAlerts.filter(
      (a) => haversineDistanceKm(lat, lng, a.area.lat, a.area.lng) <= a.area.radiusKm
    );
  }

  res.render('volunteer/dashboard', {
    title: 'Volunteer Dashboard',
    tasks,
    nearbyAlerts,
    justDelivered: req.query.delivered === '1',
  });
};

// ---------------------------------------------------------------------------
// Accept / Reject
// ---------------------------------------------------------------------------
exports.postAcceptTask = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'assigned' });
  if (task) {
    task.status = 'accepted';
    task.acceptedAt = new Date();
    await task.save();
    emitVolunteerTaskUpdate(task);

    const donation = task.donationId ? await Donation.findById(task.donationId) : null;
    if (donation) {
      await updateDonationStatus(donation, 'accepted', 'Volunteer accepted the assignment');
    } else if (task.foodRequestId) {
      const foodRequest = await FoodRequest.findById(task.foodRequestId);
      if (foodRequest) {
        await updateFoodRequestStatus(
          foodRequest,
          'accepted',
          'Volunteer accepted the assignment',
          req.user._id,
          'volunteer'
        );
      }
    }
  }
  res.redirect('/volunteer/dashboard');
};

exports.postRejectTask = async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    volunteerId: req.user._id,
    status: { $in: ['assigned', 'accepted'] },
  });
  if (task) {
    task.status = 'rejected';
    await task.save();
    emitVolunteerTaskUpdate(task);

    const donation = task.donationId ? await Donation.findById(task.donationId) : null;
    if (donation) {
      donation.assignedVolunteerId = null;
      donation.assignedByNgoId = null;
      await updateDonationStatus(donation, 'pending', 'Volunteer declined — needs reassignment');
    } else if (task.foodRequestId) {
      const foodRequest = await FoodRequest.findById(task.foodRequestId);
      if (foodRequest) {
        await updateFoodRequestStatus(
          foodRequest,
          'pending',
          'Volunteer declined — needs reassignment',
          req.user._id,
          'volunteer'
        );
      }
    }
  }
  res.redirect('/volunteer/dashboard');
};

// ---------------------------------------------------------------------------
// Mark picked
// ---------------------------------------------------------------------------
exports.postMarkPickupReached = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'accepted' });
  if (task) {
    task.status = 'pickup_reached';
    task.pickupReachedAt = new Date();
    await task.save();
    emitVolunteerTaskUpdate(task);

    const donation = task.donationId ? await Donation.findById(task.donationId) : null;
    if (donation) {
      await updateDonationStatus(donation, 'pickup_reached', 'Volunteer reached pickup location');
    } else if (task.foodRequestId) {
      const foodRequest = await FoodRequest.findById(task.foodRequestId);
      if (foodRequest) {
        await updateFoodRequestStatus(
          foodRequest,
          'pickup_reached',
          'Volunteer reached pickup location',
          req.user._id,
          'volunteer'
        );
      }
    }
  }
  res.redirect('/volunteer/dashboard');
};

exports.postMarkPicked = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'pickup_reached' });
  if (task) {
    task.status = 'picked';
    task.pickedAt = new Date();
    await task.save();
    emitVolunteerTaskUpdate(task);

    const donation = task.donationId ? await Donation.findById(task.donationId) : null;
    if (donation) {
      await updateDonationStatus(donation, 'picked', 'Picked up by volunteer');
    } else if (task.foodRequestId) {
      const foodRequest = await FoodRequest.findById(task.foodRequestId);
      if (foodRequest) {
        await updateFoodRequestStatus(
          foodRequest,
          'picked',
          'Food picked up by volunteer',
          req.user._id,
          'volunteer'
        );
      }
    }
  }
  res.redirect('/volunteer/dashboard');
};

exports.postStartDelivery = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'picked' });
  if (task) {
    task.status = 'in_transit';
    task.inTransitAt = new Date();
    await task.save();
    emitVolunteerTaskUpdate(task);

    const donation = task.donationId ? await Donation.findById(task.donationId) : null;
    if (donation) {
      await updateDonationStatus(donation, 'in_transit', 'Volunteer started the delivery route');
    } else if (task.foodRequestId) {
      const foodRequest = await FoodRequest.findById(task.foodRequestId);
      if (foodRequest) {
        await updateFoodRequestStatus(
          foodRequest,
          'in_transit',
          'Volunteer started the delivery route',
          req.user._id,
          'volunteer'
        );
      }
    }
  }
  res.redirect('/volunteer/dashboard');
};

// ---------------------------------------------------------------------------
// Delivery confirmation — OTP + feedback collection
// ---------------------------------------------------------------------------
exports.getDeliverForm = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'in_transit' })
    .populate('donationId')
    .populate('foodRequestId');
  if (!task) {
    return res.status(404).render('error', { title: 'Not found', message: 'Task not found or not ready for delivery.' });
  }
  res.render('volunteer/deliver-form', { title: 'Confirm Delivery', task, errors: null, formData: {} });
};

exports.postDeliver = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'in_transit' })
    .populate('donationId')
    .populate('foodRequestId');
  if (!task) {
    return res.status(404).render('error', { title: 'Not found', message: 'Task not found or not ready for delivery.' });
  }

  const { otp, rating, category, comment } = req.body;
  const errors = [];

  if (!otp || otp.trim() !== task.deliveryOtp) {
    errors.push('The OTP entered does not match the code generated for this delivery.');
  }
  if (!rating || !['1', '2', '3', '4', '5'].includes(String(rating))) {
    errors.push('Please select a star rating.');
  }
  if (!category || !['good', 'average', 'bad'].includes(category)) {
    errors.push('Please choose a feedback category.');
  }
  if (!req.files || !req.files.proofPhoto) {
    errors.push('A delivery proof photo is required.');
  }

  if (errors.length) {
    return res.status(400).render('volunteer/deliver-form', { title: 'Confirm Delivery', task, errors, formData: req.body });
  }

  const proofPhotoPath = `/uploads/proofs/${req.files.proofPhoto[0].filename}`;
  const voiceNotePath = req.files.voiceNote ? `/uploads/voicenotes/${req.files.voiceNote[0].filename}` : null;

  task.status = 'delivered';
  task.deliveredAt = new Date();
  task.deliveryOtpVerified = true;
  await task.save();
  emitVolunteerTaskUpdate(task);

  const donation = task.donationId;
  if (donation) {
    donation.deliveryProofPhoto = proofPhotoPath;
    await updateDonationStatus(donation, 'delivered', 'Delivered and confirmed by OTP');
  } else if (task.foodRequestId) {
    const foodRequest = await FoodRequest.findById(task.foodRequestId._id);
    if (foodRequest) {
      await updateFoodRequestStatus(
        foodRequest,
        'delivered',
        'Delivered and confirmed',
        req.user._id,
        'volunteer'
      );
    }
  }

  // Triggers volunteer completedTasks/avgRating recalculation (see Feedback model post-save hook)
  await Feedback.create({
    donationId: donation ? donation._id : null,
    foodRequestId: task.foodRequestId ? task.foodRequestId._id : null,
    taskId: task._id,
    rating: Number(rating),
    category,
    comment: comment || '',
    photoProof: proofPhotoPath,
    voiceNote: voiceNotePath,
    submittedByVolunteerId: req.user._id,
  });

  res.redirect('/volunteer/dashboard?delivered=1');
};

// ---------------------------------------------------------------------------
// Rating history — feedback this volunteer has collected
// ---------------------------------------------------------------------------
exports.getMyFeedback = async (req, res) => {
  const volunteer = await Volunteer.findById(req.user._id);
  const feedbackList = await Feedback.find({ submittedByVolunteerId: req.user._id })
    .populate('donationId', 'donationCode type')
    .sort({ createdAt: -1 });

  res.render('volunteer/my-feedback', { title: 'My Rating History', feedbackList, volunteer });
};
