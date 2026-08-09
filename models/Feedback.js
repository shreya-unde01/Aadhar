const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },

    rating: { type: Number, min: 1, max: 5, required: true },
    category: { type: String, enum: ['good', 'average', 'bad'], required: true },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },

    photoProof: { type: String, default: null },
    voiceNote: { type: String, default: null },

    // Feedback is collected by the volunteer on behalf of the recipient at
    // the point of delivery (see project spec, Volunteer Dashboard section).
    submittedByVolunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Stash whether this was a brand-new document, same pattern as Donation.js —
// post-save hooks don't reliably expose isNew otherwise.
feedbackSchema.pre('save', function (next) {
  this.$locals.wasNew = this.isNew;
  next();
});

feedbackSchema.post('save', async function (doc) {
  if (!doc.$locals.wasNew) return;
  try {
    const { onFeedbackCreated } = require('../utils/volunteerStatsEngine');
    await onFeedbackCreated(doc);
  } catch (err) {
    console.error('[feedback] post-save volunteer stats trigger failed:', err.message);
  }
});

module.exports = mongoose.model('Feedback', feedbackSchema);
