const { onDonationDelivered } = require('./reportEngine');
const { emitDonationStatus } = require('../sockets');

/**
 * Moves a donation to a new status, records it in statusHistory, and fires
 * the Report trigger on delivery. Used by the NGO admin flow (Phase 3) and
 * the volunteer pickup/delivery flow (Phase 4) so every status change goes
 * through one place — including the Phase 5 real-time push to donor/NGO screens.
 */
async function updateDonationStatus(donation, newStatus, note = '') {
  donation.status = newStatus;
  donation.statusHistory.push({ status: newStatus, note });
  await donation.save();

  emitDonationStatus(donation);

  if (newStatus === 'delivered') {
    try {
      await onDonationDelivered(donation);
    } catch (err) {
      console.error('[report] delivery trigger failed:', err.message);
    }
  }

  return donation;
}

module.exports = { updateDonationStatus };
