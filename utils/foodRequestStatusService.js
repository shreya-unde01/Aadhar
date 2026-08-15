const { emitFoodRequestStatus } = require('../sockets');

const FOOD_REQUEST_STATUS_TRANSITIONS = {
  pending: ['assigned', 'cancelled'],
  assigned: ['accepted', 'cancelled'],
  accepted: ['pickup_reached', 'cancelled'],
  pickup_reached: ['picked', 'cancelled'],
  picked: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/**
 * Moves a food request to a new status, records it in statusHistory, and fires
 * socket events for real-time updates. All volunteer and NGO status changes must
 * pass through this single validation gate.
 */
async function updateFoodRequestStatus(foodRequest, newStatus, note = '', actor = null, actorRole = null) {
  const currentStatus = foodRequest.status || 'pending';

  if (newStatus === currentStatus) {
    return foodRequest;
  }

  const allowed = FOOD_REQUEST_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid food request status transition: ${currentStatus} -> ${newStatus}`);
  }

  // Update status
  foodRequest.status = newStatus;

  // Set the corresponding timestamp
  const timestampFields = {
    assigned: 'assignedAt',
    accepted: 'acceptedAt',
    pickup_reached: 'pickupReachedAt',
    picked: 'pickedAt',
    in_transit: 'inTransitAt',
    delivered: 'deliveredAt',
  };

  if (timestampFields[newStatus] && !foodRequest[timestampFields[newStatus]]) {
    foodRequest[timestampFields[newStatus]] = new Date();
  }

  // Record in history
  foodRequest.statusHistory.push({
    from: currentStatus,
    to: newStatus,
    timestamp: new Date(),
    actor: actor || null,
    actorRole: actorRole || null,
    note,
  });

  await foodRequest.save();

  emitFoodRequestStatus(foodRequest);

  return foodRequest;
}

module.exports = { updateFoodRequestStatus, FOOD_REQUEST_STATUS_TRANSITIONS };
