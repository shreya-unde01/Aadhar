const { onDonationDelivered } = require('./reportEngine');
const { emitDonationStatus } = require('../sockets');

const DONATION_STATUS_TRANSITIONS = {
  pending: ['assigned', 'cancelled'],
  assigned: ['accepted', 'pending', 'cancelled'],
  accepted: ['pickup_reached', 'cancelled'],
  pickup_reached: ['picked', 'cancelled'],
  picked: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/**
 * Moves a donation to a new status, records it in statusHistory, and fires
 * the Report trigger on delivery. All volunteer and NGO status changes must
 * pass through this single validation gate.
 */
async function updateDonationStatus(donation, newStatus, note = '') {
  const currentStatus = donation.status || 'pending';

  if (newStatus === currentStatus) {
    return donation;
  }

  const allowed = DONATION_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid donation status transition: ${currentStatus} -> ${newStatus}`);
  }

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

module.exports = { updateDonationStatus, DONATION_STATUS_TRANSITIONS };
