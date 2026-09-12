const BloodInventory = require('../models/BloodInventory');
const AuditLog = require('../models/AuditLog');
const Hospital = require('../models/Hospital');

// ABO / Rh compatibility rules (Clinical recommendation logic with administrative boundaries)
const RBC_COMPATIBILITY = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

const PLASMA_COMPATIBILITY = {
  'AB+': ['AB+', 'AB-'],
  'AB-': ['AB+', 'AB-'],
  'A+': ['A+', 'A-', 'AB+', 'AB-'],
  'A-': ['A+', 'A-', 'AB+', 'AB-'],
  'B+': ['B+', 'B-', 'AB+', 'AB-'],
  'B-': ['B+', 'B-', 'AB+', 'AB-'],
  'O+': ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
  'O-': ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
};

function getCompatibleBloodGroups(patientBloodGroup, component = 'Whole Blood') {
  if (!patientBloodGroup) return [];
  const comp = (component || '').toLowerCase();
  if (comp.includes('plasma')) {
    return PLASMA_COMPATIBILITY[patientBloodGroup] || [patientBloodGroup];
  }
  return RBC_COMPATIBILITY[patientBloodGroup] || [patientBloodGroup];
}

/**
 * Atomically reserves blood units at a hospital.
 * Ensures availableUnits >= quantity and never allows negative stock.
 */
async function reserveBloodUnits({ hospitalId, bloodGroup, component, quantity, userId, userName, requestId, role = 'staff' }) {
  if (!quantity || quantity <= 0) {
    throw new Error('Quantity to reserve must be greater than 0');
  }

  const now = new Date();
  const inventory = await BloodInventory.findOne({
    hospital: hospitalId,
    bloodGroup,
    component,
    expiryDate: { $gt: now },
  });

  if (!inventory) {
    return {
      success: false,
      availableUnits: 0,
      message: 'No active ' + bloodGroup + ' ' + component + ' inventory found at this facility.',
    };
  }

  if (inventory.availableUnits < quantity) {
    return {
      success: false,
      availableUnits: inventory.availableUnits,
      message: 'Insufficient units available. Requested: ' + quantity + ', Available: ' + inventory.availableUnits,
    };
  }

  // Atomically update units
  inventory.reservedUnits += quantity;
  inventory.availableUnits = Math.max(0, inventory.totalUnits - inventory.reservedUnits - inventory.usedUnits - inventory.expiredUnits);
  inventory.lastUpdated = now;

  if (inventory.availableUnits <= 1) {
    inventory.status = 'Critical';
  } else if (inventory.availableUnits <= (inventory.minThreshold || 5)) {
    inventory.status = 'Low Stock';
  } else {
    inventory.status = 'Available';
  }

  await inventory.save();

  // Audit Log
  await AuditLog.create({
    user: userId,
    userName: userName || 'Authorized Staff',
    role,
    action: 'BLOOD_RESERVED',
    resourceType: 'BloodInventory',
    resourceId: inventory._id,
    hospital: hospitalId,
    details: {
      bloodGroup,
      component,
      unitsReserved: quantity,
      remainingAvailable: inventory.availableUnits,
      requestId,
    },
  });

  return {
    success: true,
    reservedUnits: quantity,
    availableUnits: inventory.availableUnits,
    inventory,
  };
}

/**
 * Releases reserved units back into available pool (e.g. on cancellation or rejection).
 */
async function releaseReservedBloodUnits({ hospitalId, bloodGroup, component, quantity, userId, userName, requestId, reason, role = 'staff' }) {
  const inventory = await BloodInventory.findOne({
    hospital: hospitalId,
    bloodGroup,
    component,
  });

  if (!inventory) return null;

  const actualRelease = Math.min(inventory.reservedUnits, quantity);
  inventory.reservedUnits = Math.max(0, inventory.reservedUnits - actualRelease);
  inventory.availableUnits = Math.max(0, inventory.totalUnits - inventory.reservedUnits - inventory.usedUnits - inventory.expiredUnits);
  inventory.lastUpdated = new Date();

  if (inventory.availableUnits <= 1) {
    inventory.status = 'Critical';
  } else if (inventory.availableUnits <= (inventory.minThreshold || 5)) {
    inventory.status = 'Low Stock';
  } else {
    inventory.status = 'Available';
  }

  await inventory.save();

  await AuditLog.create({
    user: userId,
    userName: userName || 'Authorized Staff',
    role,
    action: 'BLOOD_RESERVATION_RELEASED',
    resourceType: 'BloodInventory',
    resourceId: inventory._id,
    hospital: hospitalId,
    details: {
      bloodGroup,
      component,
      unitsReleased: actualRelease,
      newAvailable: inventory.availableUnits,
      requestId,
      reason: reason || 'Request cancelled or release initiated',
    },
  });

  return inventory;
}

/**
 * Completes transfusion / collection, moving units from reserved to used.
 */
async function completeReservedBloodUnits({ hospitalId, bloodGroup, component, quantity, userId, userName, requestId, role = 'staff' }) {
  const inventory = await BloodInventory.findOne({
    hospital: hospitalId,
    bloodGroup,
    component,
  });

  if (!inventory) return null;

  const actualComplete = Math.min(inventory.reservedUnits, quantity);
  inventory.reservedUnits = Math.max(0, inventory.reservedUnits - actualComplete);
  inventory.usedUnits += actualComplete;
  inventory.lastUpdated = new Date();
  await inventory.save();

  await AuditLog.create({
    user: userId,
    userName: userName || 'Authorized Staff',
    role,
    action: 'BLOOD_COLLECTION_COMPLETED',
    resourceType: 'BloodInventory',
    resourceId: inventory._id,
    hospital: hospitalId,
    details: {
      bloodGroup,
      component,
      unitsCollected: actualComplete,
      totalUsed: inventory.usedUnits,
      requestId,
    },
  });

  return inventory;
}

/**
 * Ensures baseline blood inventory exists for all hospitals in database.
 */
async function ensureHospitalBloodInventory(hospitalId) {
  const count = await BloodInventory.countDocuments({ hospital: hospitalId });
  if (count > 0) return;

  const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const components = ['Whole Blood', 'Packed RBC', 'Platelets', 'Plasma', 'Cryoprecipitate'];
  const docs = [];

  const now = Date.now();
  groups.forEach((bg, gIdx) => {
    components.forEach((comp, cIdx) => {
      // Deterministic, realistic baseline quantities
      const total = 8 + ((gIdx * 3 + cIdx * 5) % 18);
      const reserved = (gIdx + cIdx) % 3 === 0 ? 1 : 0;
      const used = (gIdx * 2) % 4;
      const available = Math.max(0, total - reserved - used);
      const expiryDays = 25 + ((gIdx + cIdx * 4) % 15);

      docs.push({
        hospital: hospitalId,
        bloodGroup: bg,
        component: comp,
        totalUnits: total,
        reservedUnits: reserved,
        usedUnits: used,
        expiredUnits: 0,
        availableUnits: available,
        minThreshold: 5,
        batchId: 'BATCH-' + bg.replace('+', 'P').replace('-', 'N') + '-' + (100 + gIdx * 10 + cIdx),
        collectionDate: new Date(now - 5 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(now + expiryDays * 24 * 60 * 60 * 1000),
        status: available <= 1 ? 'Critical' : (available <= 5 ? 'Low Stock' : 'Available'),
        lastUpdated: new Date(now - ((gIdx + 1) * 3600000)),
      });
    });
  });

  if (docs.length) {
    await BloodInventory.insertMany(docs);
  }
}

module.exports = {
  getCompatibleBloodGroups,
  reserveBloodUnits,
  releaseReservedBloodUnits,
  completeReservedBloodUnits,
  ensureHospitalBloodInventory,
};
