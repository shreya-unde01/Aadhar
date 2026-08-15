const mongoose = require('mongoose');
const { generateOtp } = require('../utils/otp');

const TASK_STATUSES = ['assigned', 'accepted', 'rejected', 'pickup_reached', 'picked', 'in_transit', 'delivered'];

const taskSchema = new mongoose.Schema(
  {
    donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', default: null, index: true },
    foodRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRequest', default: null, index: true },
    beneficiaryId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ngoAssignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    pickupLocation: {
      address: { type: String, required: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    // Delivery location defaults to the NGO's own address for Phase 3 — most
    // donations flow donor -> NGO collection point -> beneficiary. NGOs can
    // override with a specific beneficiary address when assigning.
    deliveryLocation: {
      address: { type: String, required: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    status: { type: String, enum: TASK_STATUSES, default: 'assigned', index: true },

    acceptedAt: { type: Date, default: null },
    pickupReachedAt: { type: Date, default: null },
    pickedAt: { type: Date, default: null },
    inTransitAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },

    // Generated at assignment time, entered by the volunteer at drop-off to
    // confirm the delivery actually reached the recipient (Transparency
    // System — see project spec, NGO Admin Dashboard section 4).
    deliveryOtp: { type: String, required: true },
    deliveryOtpVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

taskSchema.pre('validate', function (next) {
  if (!this.donationId && !this.foodRequestId) return next(new Error('A task must reference a donation or food request.'));
  if (this.donationId && this.foodRequestId) return next(new Error('A task cannot reference both a donation and food request.'));
  next();
});

taskSchema.statics.STATUSES = TASK_STATUSES;

taskSchema.statics.createForDonation = async function ({ donation, volunteerId, ngoId, beneficiaryId, deliveryAddress, deliveryLat, deliveryLng }) {
  return this.create({
    donationId: donation._id,
    beneficiaryId,
    volunteerId,
    ngoAssignedBy: ngoId,
    pickupLocation: donation.pickupLocation,
    deliveryLocation: {
      address: deliveryAddress,
      lat: deliveryLat ?? null,
      lng: deliveryLng ?? null,
    },
    deliveryOtp: generateOtp(),
  });
};

taskSchema.statics.createForFoodRequest = async function ({ request, volunteerId, ngoId }) {
  return this.create({
    foodRequestId: request._id,
    beneficiaryId: request.householdId,
    volunteerId,
    ngoAssignedBy: ngoId,
    pickupLocation: { address: 'Lions Club food collection point' },
    deliveryLocation: {
      address: request.deliveryAddress,
      lat: null,
      lng: null,
    },
    deliveryOtp: generateOtp(),
  });
};

module.exports = mongoose.model('Task', taskSchema);
