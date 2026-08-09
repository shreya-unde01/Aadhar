const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, trim: true, maxlength: 500, default: '' },

    area: {
      address: { type: String, default: '' }, // human-readable label
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      radiusKm: { type: Number, required: true, min: 0.5, max: 100, default: 5 },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmergencyAlert', emergencyAlertSchema);
