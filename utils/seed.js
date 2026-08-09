/**
 * Populates the database with the Lions Club administrator, five
 * volunteers (in a mix of approval states), eight donors, and ~20 donations
 * spread across every type and every stage of the pipeline.
 *
 * Deliberately goes through the app's own models/services (Donation.create,
 * updateDonationStatus, Feedback.create) rather than raw inserts, so the
 * same triggers that run in production — badge awards, leaderboard scores,
 * the Report collection, volunteer stats — all fire naturally and the
 * seeded data is internally consistent with what a real run would produce.
 *
 * WARNING: wipes all AADHAR collections before seeding. Only run this
 * against a development database.
 *
 * Usage: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');

const { User, Donor, Volunteer, NGOAdmin } = require('../models/User');
const Donation = require('../models/Donation');
const Task = require('../models/Task');
const Feedback = require('../models/Feedback');
const Badge = require('../models/Badge');
const Report = require('../models/Report');
const EmergencyAlert = require('../models/EmergencyAlert');

const { ensureBadgesSeeded } = require('./badgeEngine');
const { updateDonationStatus } = require('./donationStatusService');
const { LIONS_CLUB_ADMIN } = require('./lionsClub');

const DEMO_PASSWORD = 'Password123!';

// Nashik, Maharashtra — small offsets per person so distance-based volunteer
// ranking has something real to sort, even without a Google Maps API key.
const BASE_LAT = 19.9975;
const BASE_LNG = 73.7898;
function jitter(base, spread = 0.05) {
  return Math.round((base + (Math.random() - 0.5) * spread) * 10000) / 10000;
}

async function wipeDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Donation.deleteMany({}),
    Task.deleteMany({}),
    Feedback.deleteMany({}),
    Badge.deleteMany({}),
    Report.deleteMany({}),
    EmergencyAlert.deleteMany({}),
  ]);
  console.log('[seed] Cleared existing data.');
}

async function seedUsers() {
  const passwordHash = await User.hashPassword(DEMO_PASSWORD);
  const adminPasswordHash = await User.hashPassword(LIONS_CLUB_ADMIN.password);

  const ngo = await NGOAdmin.create({
    name: LIONS_CLUB_ADMIN.name,
    email: LIONS_CLUB_ADMIN.email,
    phone: LIONS_CLUB_ADMIN.phone,
    passwordHash: adminPasswordHash,
    organizationName: LIONS_CLUB_ADMIN.organizationName,
    organizationAddress: LIONS_CLUB_ADMIN.organizationAddress,
    upiId: LIONS_CLUB_ADMIN.upiId,
  });

  const volunteerSeeds = [
    { name: 'Rohit Kulkarni', email: 'volunteer@aadhar.test', isApproved: true, isActive: true }, // primary demo login
    { name: 'Sneha Patil', email: 'sneha.v@aadhar.test', isApproved: true, isActive: true },
    { name: 'Aman Sheikh', email: 'aman.v@aadhar.test', isApproved: true, isActive: true },
    { name: 'Kavita Joshi', email: 'kavita.v@aadhar.test', isApproved: false, isActive: true }, // pending approval
    { name: 'Deepak Rao', email: 'deepak.v@aadhar.test', isApproved: true, isActive: false }, // deactivated
  ];

  const volunteers = [];
  for (let i = 0; i < volunteerSeeds.length; i++) {
    const v = volunteerSeeds[i];
    volunteers.push(
      await Volunteer.create({
        name: v.name,
        email: v.email,
        phone: `90000001${10 + i}`,
        passwordHash,
        ngoId: ngo._id,
        isApproved: v.isApproved,
        isActive: v.isActive,
        isAvailable: true,
        location: { lat: jitter(BASE_LAT), lng: jitter(BASE_LNG), address: 'Nashik, Maharashtra' },
      })
    );
  }

  const donorSeeds = [
    { name: 'Ananya Verma', email: 'donor@aadhar.test', donorType: 'individual' }, // primary demo login
    { name: 'Vikram Singh', email: 'vikram.d@aadhar.test', donorType: 'individual' },
    { name: 'The Grand Regency', email: 'regency.d@aadhar.test', donorType: 'hotel', organizationName: 'The Grand Regency Hotel' },
    { name: 'Sunrise Banquets', email: 'sunrise.d@aadhar.test', donorType: 'hotel', organizationName: 'Sunrise Banquets & Events' },
    { name: 'TechNova Pvt Ltd', email: 'technova.d@aadhar.test', donorType: 'business', organizationName: 'TechNova Pvt Ltd' },
    { name: 'Meera Iyer', email: 'meera.d@aadhar.test', donorType: 'individual' },
    { name: 'Nashik Traders Assoc.', email: 'traders.d@aadhar.test', donorType: 'business', organizationName: 'Nashik Traders Association' },
    { name: 'Arjun Bhosale', email: 'arjun.d@aadhar.test', donorType: 'individual' },
  ];

  const donors = [];
  for (let i = 0; i < donorSeeds.length; i++) {
    const d = donorSeeds[i];
    donors.push(
      await Donor.create({
        name: d.name,
        email: d.email,
        phone: `90000002${10 + i}`,
        passwordHash,
        donorType: d.donorType,
        organizationName: d.organizationName || null,
      })
    );
  }

  return { ngo, volunteers, donors };
}

const APPROVED_TYPES = ['food', 'clothes', 'grocery', 'money', 'medicine', 'books', 'skill'];
const UNITS = { food: 'kg', clothes: 'items', grocery: 'kg', money: 'INR', medicine: 'units', books: 'items', skill: 'hours' };

function randomTimeSlot(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return { date, startTime: '09:00', endTime: '11:00' };
}

async function seedDonations({ ngo, volunteers, donors }) {
  const approvedVolunteers = volunteers.filter((v) => v.isApproved && v.isActive);
  let typeIndex = 0;
  const nextType = () => APPROVED_TYPES[typeIndex++ % APPROVED_TYPES.length];

  const donations = [];

  // --- 5 still pending (unassigned) ---
  for (let i = 0; i < 5; i++) {
    const type = nextType();
    donations.push(
      await Donation.create({
        donorId: donors[i % donors.length]._id,
        type,
        quantity: type === 'money' ? 1000 + i * 500 : 5 + i * 2,
        unit: UNITS[type],
        description: `Sample ${type} donation`,
        pickupLocation: { address: `Pickup Point ${i + 1}, Nashik`, lat: jitter(BASE_LAT), lng: jitter(BASE_LNG) },
        timeSlot: randomTimeSlot(0),
        expiryDate: type === 'food' ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) : null,
        urgent: i === 0, // one urgent pending donation for demo
      })
    );
  }

  // --- 4 assigned (Task created, not yet picked up) ---
  for (let i = 0; i < 4; i++) {
    const type = nextType();
    const donation = await Donation.create({
      donorId: donors[(i + 2) % donors.length]._id,
      type,
      quantity: type === 'money' ? 800 : 6 + i,
      unit: UNITS[type],
      pickupLocation: { address: `Pickup Point ${i + 6}, Nashik`, lat: jitter(BASE_LAT), lng: jitter(BASE_LNG) },
      timeSlot: randomTimeSlot(1),
    });
    const volunteer = approvedVolunteers[i % approvedVolunteers.length];
    await Task.createForDonation({
      donation,
      volunteerId: volunteer._id,
      ngoId: ngo._id,
      deliveryAddress: ngo.organizationAddress,
    });
    donation.assignedVolunteerId = volunteer._id;
    donation.assignedByNgoId = ngo._id;
    await updateDonationStatus(donation, 'assigned', `Assigned to ${volunteer.name}`);
    donations.push(donation);
  }

  // --- 3 picked up ---
  for (let i = 0; i < 3; i++) {
    const type = nextType();
    const donation = await Donation.create({
      donorId: donors[(i + 4) % donors.length]._id,
      type,
      quantity: 4 + i,
      unit: UNITS[type],
      pickupLocation: { address: `Pickup Point ${i + 10}, Nashik`, lat: jitter(BASE_LAT), lng: jitter(BASE_LNG) },
      timeSlot: randomTimeSlot(1),
    });
    const volunteer = approvedVolunteers[i % approvedVolunteers.length];
    const task = await Task.createForDonation({
      donation,
      volunteerId: volunteer._id,
      ngoId: ngo._id,
      deliveryAddress: ngo.organizationAddress,
    });
    donation.assignedVolunteerId = volunteer._id;
    donation.assignedByNgoId = ngo._id;
    await updateDonationStatus(donation, 'assigned', `Assigned to ${volunteer.name}`);
    await updateDonationStatus(donation, 'picked', 'Picked up by volunteer');
    task.status = 'picked';
    task.acceptedAt = new Date();
    task.pickedAt = new Date();
    await task.save();
    donations.push(donation);
  }

  // --- 7 delivered (with feedback, so badges/reports/volunteer stats populate) ---
  const feedbackCategories = ['good', 'good', 'good', 'average', 'good', 'bad', 'good'];
  for (let i = 0; i < 7; i++) {
    const type = nextType();
    const donation = await Donation.create({
      donorId: donors[i % donors.length]._id,
      type,
      quantity: type === 'money' ? 1200 : type === 'food' ? 15 + i : 6 + i,
      unit: UNITS[type],
      pickupLocation: { address: `Pickup Point ${i + 14}, Nashik`, lat: jitter(BASE_LAT), lng: jitter(BASE_LNG) },
      timeSlot: randomTimeSlot(3 + i),
      urgent: i === 6,
    });
    const volunteer = approvedVolunteers[i % approvedVolunteers.length];
    const task = await Task.createForDonation({
      donation,
      volunteerId: volunteer._id,
      ngoId: ngo._id,
      deliveryAddress: ngo.organizationAddress,
    });
    donation.assignedVolunteerId = volunteer._id;
    donation.assignedByNgoId = ngo._id;
    await updateDonationStatus(donation, 'assigned', `Assigned to ${volunteer.name}`);
    await updateDonationStatus(donation, 'picked', 'Picked up by volunteer');
    await updateDonationStatus(donation, 'delivered', 'Delivered and confirmed by OTP');

    task.status = 'delivered';
    task.acceptedAt = new Date();
    task.pickedAt = new Date();
    task.deliveredAt = new Date();
    task.deliveryOtpVerified = true;
    await task.save();

    // Triggers volunteer completedTasks/avgRating recalculation
    await Feedback.create({
      donationId: donation._id,
      taskId: task._id,
      rating: [5, 4, 5, 3, 5, 2, 5][i],
      category: feedbackCategories[i],
      comment: 'Sample recipient feedback for demo purposes.',
      submittedByVolunteerId: volunteer._id,
    });

    donations.push(donation);
  }

  // --- 1 cancelled ---
  const cancelledType = nextType();
  const cancelled = await Donation.create({
    donorId: donors[0]._id,
    type: cancelledType,
    quantity: 3,
    unit: UNITS[cancelledType],
    pickupLocation: { address: 'Pickup Point 21, Nashik', lat: jitter(BASE_LAT), lng: jitter(BASE_LNG) },
    timeSlot: randomTimeSlot(5),
  });
  await updateDonationStatus(cancelled, 'cancelled', 'Donor cancelled — item no longer available');
  donations.push(cancelled);

  return donations;
}

async function seedEmergencyAlert(ngo) {
  await EmergencyAlert.create({
    title: 'Flood relief needed — Panchavati',
    message: 'Heavy rainfall has displaced several families. Priority pickups appreciated.',
    createdBy: ngo._id,
    area: { address: 'Panchavati, Nashik', lat: BASE_LAT, lng: BASE_LNG, radiusKm: 8 },
    isActive: true,
  });
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('[seed] MONGO_URI is not set in your .env file.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('[seed] Connected to MongoDB.');

  await wipeDatabase();
  await ensureBadgesSeeded();
  console.log('[seed] Badge definitions seeded.');

  const { ngo, volunteers, donors } = await seedUsers();
  console.log(`[seed] Created 1 Lions Club admin, ${volunteers.length} volunteers, ${donors.length} donors.`);

  const donations = await seedDonations({ ngo, volunteers, donors });
  console.log(`[seed] Created ${donations.length} donations across every status.`);

  await seedEmergencyAlert(ngo);
  console.log('[seed] Created 1 active emergency alert.');

  console.log('\n========================================================');
  console.log(' Demo login credentials');
  console.log('========================================================');
  console.log(` Volunteer and donor password: ${DEMO_PASSWORD}`);
  console.log('--------------------------------------------------------');
  console.log(` Admin      : ${LIONS_CLUB_ADMIN.email} / ${LIONS_CLUB_ADMIN.password}`);
  console.log(' Volunteer  : volunteer@aadhar.test   (approved, ready to use)');
  console.log(' Donor      : donor@aadhar.test');
  console.log('--------------------------------------------------------');
  console.log(' Also seeded: 1 pending-approval volunteer (kavita.v@aadhar.test)');
  console.log(' and 1 deactivated volunteer (deepak.v@aadhar.test), if you want');
  console.log(' to test the NGO volunteer-approval flow with existing data.');
  console.log('========================================================\n');

  await mongoose.disconnect();
  console.log('[seed] Done. Disconnected.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
