const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid misreads

function randomSegment(length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
}

/**...
 * Generates a donation tracking code like "AAD-2026-7F3K9Q".
 * Retries on the rare collision instead of trusting randomness alone.
 */
async function generateDonationCode(DonationModel, attempt = 0) {
  const year = new Date().getFullYear();
  const code = `AAD-${year}-${randomSegment(6)}`;
  const exists = await DonationModel.exists({ donationCode: code });
  if (exists) {
    if (attempt > 5) throw new Error('Could not generate a unique donation code after several attempts');
    return generateDonationCode(DonationModel, attempt + 1);
  }
  return code;
}

module.exports = { generateDonationCode };
