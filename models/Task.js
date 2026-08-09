const mongoose = require('mongoose');
const { generateOtp } = require('../utils/otp');

const TASK_STATUSES = ['assigned', 'accepted', 'rejected', 'picked', 'delivered'];

const taskSchema = new mongoose.Schema(
  {
    donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true, index: true },
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
    pickedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },

    // Generated at assignment time, entered by the volunteer at drop-off to
    // confirm the delivery actually reached the recipient (Transparency
    // System — see project spec, NGO Admin Dashboard section 4).
    deliveryOtp: { type: String, required: true },
    deliveryOtpVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

taskSchema.statics.STATUSES = TASK_STATUSES;

taskSchema.statics.createForDonation = async function ({ donation, volunteerId, ngoId, deliveryAddress, deliveryLat, deliveryLng }) {
  return this.create({
    donationId: donation._id,
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

module.exports = mongoose.model('Task', taskSchema);
