const { Server } = require('socket.io');
const { verifyToken, COOKIE_NAME } = require('../utils/jwt');
const { User } = require('../models/User');
const { LIONS_CLUB_ADMIN } = require('../utils/lionsClub');

let ioInstance = null;

function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = decodeURIComponent(pair.slice(0, idx).trim());
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    out[key] = val;
  });
  return out;
}

/**
 * Same JWT-in-httpOnly-cookie scheme as the regular HTTP middleware
 * (middleware/auth.js) — Socket.io's handshake still carries cookies, so we
 * verify the same token rather than inventing a second auth mechanism.
 */
function initSockets(server) {
  ioInstance = new Server(server, {
    cors: { origin: false }, // same-origin only — this app doesn't serve a separate frontend
  });

  ioInstance.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie || '');
      const token = cookies[COOKIE_NAME];
      if (!token) return next(); // anonymous connections are fine — just no rooms joined

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id);
      if (user && user.isActive && (user.role !== 'ngo_admin' || user.email === LIONS_CLUB_ADMIN.email)) {
        socket.user = { id: user._id.toString(), role: user.role };
      }
      next();
    } catch (err) {
      next(); // invalid/expired token — treat as anonymous rather than rejecting the socket
    }
  });

  ioInstance.on('connection', (socket) => {
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
      socket.join(`role:${socket.user.role}`);
    }
  });

  return ioInstance;
}

function getIO() {
  return ioInstance;
}

// ---------------------------------------------------------------------------
// Emit helpers — controllers/services call these instead of touching the
// raw `io` instance, and every one safely no-ops if sockets aren't ready.
// ---------------------------------------------------------------------------

/** Donation status changed — used by donor tracking pages, donor's list, and NGO's donations list. */
function emitDonationStatus(donation) {
  if (!ioInstance) return;
  const payload = {
    donationId: donation._id.toString(),
    donationCode: donation.donationCode,
    status: donation.status,
  };
  ioInstance.to(`donation:${donation._id}`).emit('donation:status', payload);
  ioInstance.to(`user:${donation.donorId}`).emit('donation:status', payload);
  ioInstance.to('role:ngo_admin').emit('donation:status', payload);
}

/** A brand-new donation was submitted — used to live-bump NGO overview counts. */
function emitNewDonation(donation) {
  if (!ioInstance) return;
  ioInstance.to('role:ngo_admin').emit('donation:new', {
    donationId: donation._id.toString(),
    donationCode: donation.donationCode,
    type: donation.type,
  });
}

/** NGO assigned a task — notifies the specific volunteer so their dashboard can toast "New task!". */
function emitTaskAssigned(task, volunteer) {
  if (!ioInstance) return;
  ioInstance.to(`user:${task.volunteerId}`).emit('task:new', {
    taskId: task._id.toString(),
    volunteerName: volunteer.name,
  });
}

/** Volunteer changed a task's status — notifies NGO admins for the logistics/dashboard live view. */
function emitVolunteerTaskUpdate(task) {
  if (!ioInstance) return;
  ioInstance.to('role:ngo_admin').emit('task:update', {
    taskId: task._id.toString(),
    status: task.status,
  });
}

/** A volunteer signed up — notifies NGO admins so pending-approval counts update live. */
function emitNewVolunteerSignup(volunteer) {
  if (!ioInstance) return;
  ioInstance.to('role:ngo_admin').emit('volunteer:new', {
    volunteerId: volunteer._id.toString(),
    name: volunteer.name,
  });
}

/** NGO declared an emergency — pushed only to volunteers actually within range (computed by the caller). */
function emitEmergencyAlert(alert, nearbyVolunteerIds) {
  if (!ioInstance) return;
  const payload = {
    alertId: alert._id.toString(),
    title: alert.title,
    message: alert.message,
    address: alert.area.address,
  };
  nearbyVolunteerIds.forEach((id) => {
    ioInstance.to(`user:${id}`).emit('emergency:new', payload);
  });
}

/** A donation was delivered — broadcast to everyone (including anonymous visitors) so public impact counters can bump live. */
function emitPublicImpactUpdate(donation) {
  if (!ioInstance) return;
  ioInstance.emit('impact:update', {
    type: donation.type,
    quantity: donation.quantity,
  });
}

module.exports = {
  initSockets,
  getIO,
  emitDonationStatus,
  emitNewDonation,
  emitTaskAssigned,
  emitVolunteerTaskUpdate,
  emitNewVolunteerSignup,
  emitEmergencyAlert,
  emitPublicImpactUpdate,
};
