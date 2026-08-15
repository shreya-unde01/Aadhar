const FoodRequest = require('../models/FoodRequest');
const { Elderly, Volunteer } = require('../models/User');

exports.getDashboard = async (req, res) => {
  const [household, requests] = await Promise.all([
    Elderly.findById(req.user._id),
    FoodRequest.find({ householdId: req.user._id }).sort({ createdAt: -1 }).limit(10),
  ]);

  res.render('elderly/dashboard', {
    title: 'Food Support',
    household,
    requests,
    requested: req.query.requested === '1',
  });
};

exports.getRequestForm = (req, res) => {
  res.render('elderly/request-form', {
    title: 'Request Food Delivery',
    errors: null,
    formData: {
      deliveryAddress: req.user.homeAddress || '',
    },
  });
};

exports.postRequest = async (req, res) => {
  const { requirements, deliveryAddress, deliveryNote } = req.body;
  const formData = { requirements, deliveryAddress, deliveryNote };

  if (!requirements || !requirements.trim() || !deliveryAddress || !deliveryAddress.trim()) {
    return res.status(400).render('elderly/request-form', {
      title: 'Request Food Delivery',
      errors: ['Please tell us what food you need and where it should be delivered.'],
      formData,
    });
  }

  try {
    await FoodRequest.create({
      householdId: req.user._id,
      requirements: requirements.trim(),
      deliveryAddress: deliveryAddress.trim(),
      deliveryNote: deliveryNote ? deliveryNote.trim() : '',
      phone: req.user.phone,
    });
    res.redirect('/elderly/dashboard?requested=1');
  } catch (err) {
    console.error('[elderly] food request error:', err);
    res.status(500).render('elderly/request-form', {
      title: 'Request Food Delivery',
      errors: ['We could not save your request. Please try again.'],
      formData,
    });
  }
};

exports.getRequestDetail = async (req, res) => {
  const request = await FoodRequest.findOne({
    _id: req.params.id,
    householdId: req.user._id,
  }).populate('assignedVolunteerId', 'name phone avgRating');

  if (!request) {
    return res.status(404).render('error', {
      title: 'Not found',
      message: 'Food request not found.',
    });
  }

  res.render('elderly/request-detail', {
    title: 'Track Your Food Request',
    request,
  });
};
