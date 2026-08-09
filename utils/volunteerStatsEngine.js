/**
 * Fires once per newly-created Feedback (see Feedback model post-save hook).
 * Feedback is only ever created at the point of delivery in this app, so
 * "one feedback logged" and "one task completed" are the same event —
 * this keeps the volunteer's completedTasks/avgRating in sync without a
 * separate write path to forget about.
 */
async function onFeedbackCreated(feedback) {
  const { Volunteer } = require('../models/User');
  const Feedback = require('../models/Feedback');

  const volunteer = await Volunteer.findById(feedback.submittedByVolunteerId);
  if (!volunteer) return;

  volunteer.completedTasks += 1;

  const [agg] = await Feedback.aggregate([
    { $match: { submittedByVolunteerId: volunteer._id } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  if (agg) {
    volunteer.avgRating = Math.round(agg.avg * 10) / 10;
    volunteer.ratingCount = agg.count;
  }

  await volunteer.save();
}

module.exports = { onFeedbackCreated };
