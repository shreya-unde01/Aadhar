const { NGOAdmin } = require('../models/User');
const { Volunteer } = require('../models/User');
const Donation = require('../models/Donation');
const Task = require('../models/Task');
const EmergencyAlert = require('../models/EmergencyAlert');

// AADHAR operates with one NGO: Lions Club, Kopargaon.  Keeping this in one
// place prevents a second NGO account from being selected accidentally.
const LIONS_CLUB_ADMIN = Object.freeze({
  name: 'Lions Club Kopargaon Admin',
  email: 'lionsclubkopargaon@gmail.com',
  password: 'lion@#06',
  phone: '0000000000',
  organizationName: 'Lions Club Kopargaon',
  organizationAddress: 'Kopargaon, Maharashtra',
  upiId: 'lionsclubkopargaon@upi',
});

async function getLionsClubAdmin(select = '') {
  return NGOAdmin.findOne({ email: LIONS_CLUB_ADMIN.email }).select(select);
}

// Safe to call on every application start. It creates the one permitted NGO
// admin the first time and restores the fixed credentials if they were changed.
async function ensureLionsClubAdmin() {
  const passwordHash = await NGOAdmin.hashPassword(LIONS_CLUB_ADMIN.password);

  const lionsClubAdmin = await NGOAdmin.findOneAndUpdate(
    { email: LIONS_CLUB_ADMIN.email },
    {
      $set: {
        name: LIONS_CLUB_ADMIN.name,
        phone: LIONS_CLUB_ADMIN.phone,
        passwordHash,
        isActive: true,
        organizationName: LIONS_CLUB_ADMIN.organizationName,
        organizationAddress: LIONS_CLUB_ADMIN.organizationAddress,
        upiId: LIONS_CLUB_ADMIN.upiId,
      },
      $setOnInsert: { email: LIONS_CLUB_ADMIN.email },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  // Older deployments may contain admin accounts created before the platform
  // became Lions Club-only. Keep their operational records available, but
  // attach them to the one supported administrator and disable their logins.
  const legacyAdminIds = await NGOAdmin.find({ _id: { $ne: lionsClubAdmin._id } }).distinct('_id');
  if (legacyAdminIds.length) {
    await Promise.all([
      Volunteer.updateMany({ ngoId: { $in: legacyAdminIds } }, { $set: { ngoId: lionsClubAdmin._id } }),
      Donation.updateMany(
        { ngoId: { $in: legacyAdminIds } },
        { $set: { ngoId: lionsClubAdmin._id, assignedByNgoId: lionsClubAdmin._id } }
      ),
      Task.updateMany({ ngoAssignedBy: { $in: legacyAdminIds } }, { $set: { ngoAssignedBy: lionsClubAdmin._id } }),
      EmergencyAlert.updateMany({ createdBy: { $in: legacyAdminIds } }, { $set: { createdBy: lionsClubAdmin._id } }),
      NGOAdmin.updateMany({ _id: { $in: legacyAdminIds } }, { $set: { isActive: false } }),
    ]);
  }

  return lionsClubAdmin;
}

module.exports = { LIONS_CLUB_ADMIN, getLionsClubAdmin, ensureLionsClubAdmin };
