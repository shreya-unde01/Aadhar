const Report = require('../models/Report');
const { emitPublicImpactUpdate } = require('../sockets');

function todayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Runs once per donation transitioning to 'delivered'. Increments a daily
 * Report document rather than computing aggregates on every dashboard load
 * (project decision: reports are trigger-updated, not live-aggregated).
 * Best-effort — callers should not let a failure here block a status update.
 */
async function onDonationDelivered(donation) {
  const inc = {
    donationsDelivered: 1,
    [`byType.${donation.type}`]: 1,
  };

  if (donation.type === 'food') {
    inc.mealsDelivered = donation.quantity;
    inc.wasteReducedKg = donation.quantity; // rough 1:1 estimate for MVP
  } else if (donation.type === 'money') {
    inc.moneyRaised = donation.quantity;
  } else if (donation.type === 'skill') {
    inc.skillHoursOffered = donation.quantity;
  } else {
    // clothes, grocery, medicine, books
    inc.itemsDistributed = donation.quantity;
  }

  await Report.findOneAndUpdate({ date: todayKey() }, { $inc: inc }, { upsert: true, new: true });
  emitPublicImpactUpdate(donation);
}

module.exports = { onDonationDelivered };
