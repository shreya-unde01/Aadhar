const Badge = require('../models/Badge');

/**
 * Fixed badge ladder based on total donation count. Simple and predictable
 * for an MVP — easy to extend with type-specific badges (e.g. "Book Buddy")
 * later without touching the trigger logic itself.
 */
const BADGE_DEFINITIONS = [
  { key: 'first_step', name: 'First Step', icon: '🌱', threshold: 1, description: 'Made your first donation on AADHAR.' },
  { key: 'helping_hand', name: 'Helping Hand', icon: '🤝', threshold: 5, description: 'Reached 5 donations.' },
  { key: 'food_hero', name: 'Food Hero', icon: '🍲', threshold: 15, description: 'Reached 15 donations.' },
  { key: 'community_champion', name: 'Community Champion', icon: '🏆', threshold: 30, description: 'Reached 30 donations.' },
  { key: 'legacy_of_giving', name: 'Legacy of Giving', icon: '✨', threshold: 50, description: 'Reached 50 donations.' },
];

/** Idempotent — safe to call on every server boot. Upserts canonical Badge docs. */
async function ensureBadgesSeeded() {
  for (const def of BADGE_DEFINITIONS) {
    await Badge.findOneAndUpdate({ key: def.key }, def, { upsert: true, new: true });
  }
}

const POINTS_PER_DONATION = 10;

/**
 * Runs once per newly-created donation. Updates the donor's running total
 * and leaderboard score, then awards any badges newly unlocked by crossing
 * a threshold. Never throws — a failure here should never block a donation
 * from being recorded, so callers should treat this as best-effort.
 */
async function onDonationCreated(donation) {
  const { Donor } = require('../models/User');

  const donor = await Donor.findById(donation.donorId);
  if (!donor) return;

  donor.totalDonations += 1;
  donor.leaderboardScore += POINTS_PER_DONATION;

  const earnedKeys = new Set();
  for (const b of donor.badges) {
    const badgeDoc = await Badge.findById(b.badgeId).select('key').lean();
    if (badgeDoc) earnedKeys.add(badgeDoc.key);
  }

  const newlyEarned = BADGE_DEFINITIONS.filter(
    (def) => donor.totalDonations >= def.threshold && !earnedKeys.has(def.key)
  );

  for (const def of newlyEarned) {
    const badgeDoc = await Badge.findOne({ key: def.key });
    if (badgeDoc) {
      donor.badges.push({ badgeId: badgeDoc._id, awardedAt: new Date() });
    }
  }

  await donor.save();
  return { newlyEarned };
}

module.exports = { BADGE_DEFINITIONS, ensureBadgesSeeded, onDonationCreated };
