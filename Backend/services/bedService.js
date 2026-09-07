const Bed = require('../models/Bed');

/**
 * Derives status ('available', 'limited', 'full') from available beds count and total beds
 */
function deriveStatus(availableBeds, totalBeds) {
  if (availableBeds <= 0) return 'full';
  if (availableBeds <= 5 || (totalBeds > 0 && availableBeds / totalBeds <= 0.2)) {
    return 'limited';
  }
  return 'available';
}

/**
 * Formats an array of Bed documents into a structured summary for a hospital
 */
function formatBedSummary(beds = []) {
  const summary = {
    general: { total: 0, occupied: 0, reserved: 0, available: 0 },
    icu: { total: 0, occupied: 0, reserved: 0, available: 0 },
    oxygen: { total: 0, occupied: 0, reserved: 0, available: 0 },
    ventilator: { total: 0, occupied: 0, reserved: 0, available: 0 },
  };

  let totalAvailable = 0;
  let totalBeds = 0;
  let latestUpdate = null;

  for (const b of beds) {
    if (summary[b.type]) {
      summary[b.type] = {
        _id: b._id,
        total: b.totalBeds,
        occupied: b.occupiedBeds,
        reserved: b.reservedBeds,
        available: b.availableBeds,
        lastUpdated: b.lastUpdated,
      };
      totalAvailable += b.availableBeds;
      totalBeds += b.totalBeds;

      if (!latestUpdate || new Date(b.lastUpdated) > new Date(latestUpdate)) {
        latestUpdate = b.lastUpdated;
      }
    }
  }

  const overallStatus = deriveStatus(totalAvailable, totalBeds);

  return {
    bedSummary: summary,
    // Convenience fields directly matching existing frontend expectations
    generalBeds: summary.general.available,
    icuBeds: summary.icu.available,
    oxygenBeds: summary.oxygen.available,
    ventilators: summary.ventilator.available,
    totalAvailable,
    totalBeds,
    status: overallStatus,
    lastUpdated: latestUpdate || new Date(),
  };
}

/**
 * Socket.IO emitter helper
 */
function broadcastBedUpdate(io, payload) {
  if (io) {
    io.emit('bedAvailabilityUpdated', payload);
  }
}

module.exports = {
  deriveStatus,
  formatBedSummary,
  broadcastBedUpdate,
};
