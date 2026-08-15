const mongoose = require('mongoose');

const REQUEST_STATUSES = ['pending', 'assigned', 'out_for_delivery', 'delivered', 'cancelled'];

const foodRequestSchema = new mongoose.Schema(
  {
    householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requirements: { type: String, required: true, trim: true, maxlength: 1000 },
    deliveryAddress: { type: String, required: true, trim: true, maxlength: 500 },
    phone: { type: String, required: true, trim: true },
    status: { type: String, enum: REQUEST_STATUSES, default: 'pending', index: true },
    deliveryNote: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

foodRequestSchema.statics.STATUSES = REQUEST_STATUSES;

module.exports = mongoose.model('FoodRequest', foodRequestSchema);
