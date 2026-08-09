const Donation = require('../models/Donation');
const Report = require('../models/Report');
const { Volunteer, Donor } = require('../models/User');

/**
 * All-time platform impact numbers, pulled live from the DB. Report holds
 * one document per day (trigger-updated on delivery — see reportEngine.js),
 * so summing the whole collection is cheap even after years of use.
 */
async function getPublicStats() {
  const [totalDonations, agg, activeVolunteers, donorCount] = await Promise.all([
    Donation.countDocuments({}),
    Report.aggregate([
      {
        $group: {
          _id: null,
          donationsDelivered: { $sum: '$donationsDelivered' },
          mealsDelivered: { $sum: '$mealsDelivered' },
          itemsDistributed: { $sum: '$itemsDistributed' },
          moneyRaised: { $sum: '$moneyRaised' },
          skillHoursOffered: { $sum: '$skillHoursOffered' },
          wasteReducedKg: { $sum: '$wasteReducedKg' },
        },
      },
    ]),
    Volunteer.countDocuments({ isApproved: true, isActive: true }),
    Donor.countDocuments({}),
  ]);

  const totals = agg[0] || {
    donationsDelivered: 0,
    mealsDelivered: 0,
    itemsDistributed: 0,
    moneyRaised: 0,
    skillHoursOffered: 0,
    wasteReducedKg: 0,
  };

  // "People helped" is a clearly-labeled estimate, not a precise headcount —
  // each delivered donation is assumed to reach roughly 3 people on average
  // (a conservative household-size proxy), since the platform doesn't track
  // individual recipients.
  const peopleHelpedEstimate = Math.round(totals.donationsDelivered * 3);

  return {
    totalDonations,
    donationsDelivered: totals.donationsDelivered,
    mealsDelivered: totals.mealsDelivered,
    itemsDistributed: totals.itemsDistributed,
    moneyRaised: totals.moneyRaised,
    skillHoursOffered: totals.skillHoursOffered,
    wasteReducedKg: totals.wasteReducedKg,
    peopleHelpedEstimate,
    activeVolunteers,
    ngoCount: 1,
    donorCount,
  };
}

module.exports = { getPublicStats };
