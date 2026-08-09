const mongoose = require('mongoose');
const { generateDonationCode } = require('../utils/donationCode');

const DONATION_TYPES = ['food'];
const DONATION_STATUSES = ['pending', 'assigned', 'picked', 'delivered', 'cancelled'];

const donationSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: DONATION_TYPES, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true, default: null }, // e.g. 'kg', 'plates', 'items', 'INR', 'hours'
    description: { type: String, trim: true, maxlength: 500, default: '' },

    ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    pickupLocation: {
      address: { type: String, required: true, trim: true },
      lat: { type: Number, default: null }, // populated by Google Maps picker from Phase 5
      lng: { type: Number, default: null },
    },

    timeSlot: {
      date: { type: Date, required: true },
      startTime: { type: String, required: true }, // '09:00' 24h format
      endTime: { type: String, required: true },
    },

    expiryDate: { type: Date, default: null }, // food only

    status: { type: String, enum: DONATION_STATUSES, default: 'pending', index: true },
    urgent: { type: Boolean, default: false },

    donationCode: { type: String, unique: true, required: true, index: true },

    // Ties together multiple items submitted in one bulk-donation form (hotels/events)
    bulkGroupId: { type: String, default: null, index: true },

    // Set by NGO admin in Phase 3 (assignment) and volunteer actions in Phase 4
    assignedVolunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedByNgoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deliveryProofPhoto: { type: String, default: null },

    statusHistory: [
      {
        status: { type: String, enum: DONATION_STATUSES, required: true },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

donationSchema.index({ 'pickupLocation.lat': 1, 'pickupLocation.lng': 1 });

// Assign a unique donationCode and seed statusHistory before the very first save.
donationSchema.pre('validate', async function (next) {
  if (this.isNew) {
    if (!this.donationCode) {
      this.donationCode = await generateDonationCode(this.constructor);
    }
    if (this.statusHistory.length === 0) {
      this.statusHistory.push({ status: this.status || 'pending', note: 'Donation submitted' });
    }
  }
  next();
});

// Stash whether this was a brand-new document — post-save hooks in Mongoose
// don't reliably expose isNew, so we capture it in pre-save.
donationSchema.pre('save', function (next) {
  this.$locals.wasNew = this.isNew;
  next();
});

donationSchema.post('save', async function (doc) {
  if (!doc.$locals.wasNew) return; // only run badge/leaderboard logic on creation, not status updates
  try {
    const { onDonationCreated } = require('../utils/badgeEngine');
    await onDonationCreated(doc);
  } catch (err) {
    console.error('[donation] post-save badge/leaderboard trigger failed:', err.message);
  }
});

donationSchema.statics.TYPES = DONATION_TYPES;
donationSchema.statics.STATUSES = DONATION_STATUSES;

const Donation = mongoose.model('Donation', donationSchema);
module.exports = Donation;
