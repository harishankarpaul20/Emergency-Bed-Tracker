const Hospital = require('../models/Hospital');
const BloodInventory = require('../models/BloodInventory');
const BedRequest = require('../models/BedRequest');
const AuditLog = require('../models/AuditLog');
const { getCompatibleBloodGroups, ensureHospitalBloodInventory } = require('../services/bloodInventoryService');

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * @desc Search available blood banks & stock with smart compatibility ranking
 * @route GET /api/blood-banks/search or /api/blood-availability
 */
const searchBloodAvailability = async (req, res, next) => {
  try {
    const {
      bloodGroup,
      component = 'Whole Blood',
      district,
      city,
      quantity = 1,
      latitude,
      longitude,
    } = req.query;

    const userLat = latitude ? parseFloat(latitude) : null;
    const userLon = longitude ? parseFloat(longitude) : null;
    const reqQty = parseInt(quantity, 10) || 1;

    // Build hospital query
    const hospQuery = { isActive: true };
    if (district && district !== 'all' && district !== 'All Districts') {
      hospQuery.district = new RegExp('^' + district.trim() + '$', 'i');
    }
    if (city && city !== 'all' && city !== 'All Areas') {
      hospQuery.area = new RegExp(city.trim(), 'i');
    }

    const hospitals = await Hospital.find(hospQuery).lean();

    // Ensure inventory exists for these hospitals
    for (const h of hospitals) {
      await ensureHospitalBloodInventory(h._id);
    }

    // Determine compatible blood groups if group is specified
    const targetGroups = bloodGroup ? getCompatibleBloodGroups(bloodGroup, component) : [];

    // Query inventory
    const invQuery = {
      hospital: { $in: hospitals.map(h => h._id) },
    };
    if (bloodGroup) {
      invQuery.bloodGroup = { $in: targetGroups };
    }
    if (component && component !== 'all') {
      invQuery.component = component;
    }

    const now = new Date();
    const inventoryRecords = await BloodInventory.find({
      ...invQuery,
      expiryDate: { $gt: now },
    }).lean();

    // Map inventory by hospital
    const hospMap = new Map();
    hospitals.forEach(h => {
      const distKm = (userLat && userLon && h.latitude && h.longitude)
        ? calculateDistanceKm(userLat, userLon, h.latitude, h.longitude)
        : null;

      hospMap.set(h._id.toString(), {
        _id: h._id,
        id: h._id,
        name: h.name + ' Blood Bank',
        hospitalName: h.name,
        hospitalId: h._id,
        district: h.district,
        area: h.area,
        address: h.address,
        phone: h.phone,
        email: h.email,
        latitude: h.latitude,
        longitude: h.longitude,
        distanceKm: distKm,
        isVerified: h.isVerified,
        inventory: [],
        totalAvailableForGroup: 0,
        exactMatchAvailable: 0,
        hasSufficientStock: false,
        status: 'Unavailable',
        lastUpdated: h.lastAvailabilityUpdate || h.updatedAt,
      });
    });

    inventoryRecords.forEach(inv => {
      const hosp = hospMap.get(inv.hospital.toString());
      if (!hosp) return;

      hosp.inventory.push({
        bloodGroup: inv.bloodGroup,
        component: inv.component,
        availableUnits: inv.availableUnits,
        reservedUnits: inv.reservedUnits,
        status: inv.status,
        lastUpdated: inv.lastUpdated,
      });

      if (!bloodGroup || inv.bloodGroup === bloodGroup) {
        hosp.exactMatchAvailable += inv.availableUnits;
      }
      hosp.totalAvailableForGroup += inv.availableUnits;
    });

    // Score and rank hospitals
    const results = Array.from(hospMap.values()).map(h => {
      const available = bloodGroup ? h.exactMatchAvailable : h.totalAvailableForGroup;
      if (available >= reqQty) {
        h.status = 'Available';
        h.hasSufficientStock = true;
      } else if (available > 0) {
        h.status = 'Low Stock';
        h.hasSufficientStock = false;
      } else {
        h.status = 'Unavailable';
        h.hasSufficientStock = false;
      }

      // Ranking score
      let score = 0;
      if (h.exactMatchAvailable >= reqQty) score += 1000;
      else if (h.totalAvailableForGroup >= reqQty) score += 700;
      else if (h.exactMatchAvailable > 0) score += 300;

      if (h.distanceKm !== null) {
        score -= Math.min(500, h.distanceKm * 5);
      }

      h.rankScore = score;
      h.isRecommended = score >= 600;
      return h;
    });

    // Sort: highest score first, then closest distance
    results.sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return b.totalAvailableForGroup - a.totalAvailableForGroup;
    });

    res.status(200).json({
      success: true,
      count: results.length,
      searchedCriteria: {
        bloodGroup: bloodGroup || 'All',
        compatibleGroups: targetGroups,
        component,
        district: district || 'All',
        quantity: reqQty,
      },
      disclaimer: 'Blood availability is demo and administrative stock data. Healthcare staff make final clinical compatibility and transfusion decisions.',
      data: results,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get all blood banks across West Bengal
 * @route GET /api/blood-banks
 */
const getBloodBanks = async (req, res, next) => {
  try {
    const { district, search } = req.query;
    const query = { isActive: true };

    if (district && district !== 'all') {
      query.district = new RegExp('^' + district.trim() + '$', 'i');
    }
    if (search) {
      query.$or = [
        { name: new RegExp(search.trim(), 'i') },
        { address: new RegExp(search.trim(), 'i') },
        { area: new RegExp(search.trim(), 'i') },
      ];
    }

    const hospitals = await Hospital.find(query).lean();
    for (const h of hospitals) {
      await ensureHospitalBloodInventory(h._id);
    }

    const hospIds = hospitals.map(h => h._id);
    const inventories = await BloodInventory.find({
      hospital: { $in: hospIds },
    }).lean();

    const data = hospitals.map(h => {
      const items = inventories.filter(i => i.hospital.toString() === h._id.toString());
      const totalUnits = items.reduce((acc, curr) => acc + (curr.availableUnits || 0), 0);
      const groupsAvailable = [...new Set(items.filter(i => i.availableUnits > 0).map(i => i.bloodGroup))];

      return {
        _id: h._id,
        id: h._id,
        name: h.name + ' Blood Bank',
        hospitalName: h.name,
        district: h.district,
        area: h.area,
        address: h.address,
        phone: h.phone,
        email: h.email,
        latitude: h.latitude,
        longitude: h.longitude,
        totalAvailableUnits: totalUnits,
        groupsAvailable,
        lastUpdated: h.lastAvailabilityUpdate || h.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get specific blood bank details with full inventory breakdown
 * @route GET /api/blood-banks/:id
 */
const getBloodBankById = async (req, res, next) => {
  try {
    const hosp = await Hospital.findById(req.params.id).lean();
    if (!hosp) {
      return res.status(404).json({ success: false, message: 'Blood bank facility not found' });
    }

    await ensureHospitalBloodInventory(hosp._id);

    const now = new Date();
    const inventory = await BloodInventory.find({ hospital: hosp._id }).sort({ bloodGroup: 1, component: 1 }).lean();

    const aggregateByGroup = {};
    inventory.forEach(inv => {
      if (!aggregateByGroup[inv.bloodGroup]) {
        aggregateByGroup[inv.bloodGroup] = {
          bloodGroup: inv.bloodGroup,
          totalAvailable: 0,
          totalReserved: 0,
          components: [],
        };
      }
      aggregateByGroup[inv.bloodGroup].totalAvailable += inv.availableUnits;
      aggregateByGroup[inv.bloodGroup].totalReserved += inv.reservedUnits;
      aggregateByGroup[inv.bloodGroup].components.push({
        component: inv.component,
        availableUnits: inv.availableUnits,
        reservedUnits: inv.reservedUnits,
        status: inv.status,
        expiryDate: inv.expiryDate,
        isExpiringSoon: inv.expiryDate && (new Date(inv.expiryDate) - now) < (3 * 24 * 60 * 60 * 1000),
      });
    });

    res.status(200).json({
      success: true,
      data: {
        _id: hosp._id,
        name: hosp.name + ' Blood Bank',
        hospitalName: hosp.name,
        district: hosp.district,
        area: hosp.area,
        address: hosp.address,
        phone: hosp.phone,
        email: hosp.email,
        latitude: hosp.latitude,
        longitude: hosp.longitude,
        lastUpdated: hosp.lastAvailabilityUpdate,
        inventory: Object.values(aggregateByGroup),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get raw inventory records for authorized hospital staff
 * @route GET /api/blood-inventory
 * @access Private (hospital_admin, blood_bank_staff, super_admin)
 */
const getInventory = async (req, res, next) => {
  try {
    let hospId = req.query.hospitalId;

    if (req.user.role === 'hospital_admin' || req.user.role === 'blood_bank_staff' || req.user.role === 'doctor') {
      hospId = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
    }

    if (!hospId && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized: No hospital assigned.' });
    }

    const query = hospId ? { hospital: hospId } : {};
    const inventory = await BloodInventory.find(query)
      .populate('hospital', 'name district area')
      .sort({ bloodGroup: 1, component: 1 })
      .lean();

    const lowStockAlerts = inventory.filter(i => i.status === 'Low Stock' || i.status === 'Critical');
    const now = new Date();
    const expiringSoon = inventory.filter(i => i.expiryDate && (new Date(i.expiryDate) - now) < 3 * 24 * 60 * 60 * 1000);

    res.status(200).json({
      success: true,
      count: inventory.length,
      lowStockCount: lowStockAlerts.length,
      expiringSoonCount: expiringSoon.length,
      data: inventory,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Update inventory levels
 * @route POST /api/blood-inventory/update
 * @access Private
 */
const updateInventory = async (req, res, next) => {
  try {
    const { hospitalId, bloodGroup, component, totalUnits, minThreshold, expiryDate, batchId } = req.body;

    const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
    if (req.user.role !== 'super_admin' && String(userHosp) !== String(hospitalId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized to modify another facility inventory.' });
    }

    let item = await BloodInventory.findOne({ hospital: hospitalId, bloodGroup, component });
    if (!item) {
      item = new BloodInventory({
        hospital: hospitalId,
        bloodGroup,
        component,
        totalUnits: parseInt(totalUnits, 10) || 0,
        reservedUnits: 0,
        usedUnits: 0,
        expiredUnits: 0,
        availableUnits: parseInt(totalUnits, 10) || 0,
        minThreshold: minThreshold ? parseInt(minThreshold, 10) : 5,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        batchId,
      });
    } else {
      item.totalUnits = parseInt(totalUnits, 10);
      if (minThreshold !== undefined) item.minThreshold = parseInt(minThreshold, 10);
      if (expiryDate) item.expiryDate = new Date(expiryDate);
      if (batchId) item.batchId = batchId;
    }

    await item.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'INVENTORY_STOCK_UPDATED',
      resourceType: 'BloodInventory',
      resourceId: item._id,
      hospital: hospitalId,
      details: {
        bloodGroup,
        component,
        totalUnits: item.totalUnits,
        availableUnits: item.availableUnits,
        reservedUnits: item.reservedUnits,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Blood inventory successfully updated.',
      data: item,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get state-wide blood statistics and analytics
 * @route GET /api/blood-banks/statistics
 */
const getBloodStatistics = async (req, res, next) => {
  try {
    const allHospitals = await Hospital.find({ isActive: true }).select('_id').lean();
    for (const h of allHospitals) {
      await ensureHospitalBloodInventory(h._id);
    }

    const inventories = await BloodInventory.find().lean();
    let totalUnits = 0;
    let totalReserved = 0;
    let lowStockCount = 0;
    let expiredCount = 0;

    const byGroup = {};
    const byComponent = {};

    inventories.forEach(inv => {
      totalUnits += (inv.availableUnits || 0);
      totalReserved += (inv.reservedUnits || 0);
      if (inv.status === 'Low Stock' || inv.status === 'Critical') lowStockCount++;
      if (inv.status === 'Expired') expiredCount++;

      byGroup[inv.bloodGroup] = (byGroup[inv.bloodGroup] || 0) + (inv.availableUnits || 0);
      byComponent[inv.component] = (byComponent[inv.component] || 0) + (inv.availableUnits || 0);
    });

    const activeRequests = await BedRequest.countDocuments({
      requestType: 'BLOOD',
      status: { $in: ['pending', 'PENDING', 'SENT', 'ACCEPTED', 'BLOOD_RESERVED'] },
    });

    const emergencyRequests = await BedRequest.countDocuments({
      requestType: 'BLOOD',
      urgency: { $in: ['Emergency', 'emergency'] },
      status: { $in: ['pending', 'PENDING', 'SENT', 'ACCEPTED', 'BLOOD_RESERVED'] },
    });

    res.status(200).json({
      success: true,
      data: {
        totalBloodUnitsAvailable: totalUnits,
        totalBloodUnitsReserved: totalReserved,
        activeRequests,
        emergencyRequests,
        lowStockBloodGroups: lowStockCount,
        expiredUnits: expiredCount,
        breakdownByGroup: byGroup,
        breakdownByComponent: byComponent,
        trackedFacilities: allHospitals.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  searchBloodAvailability,
  getBloodBanks,
  getBloodBankById,
  getInventory,
  updateInventory,
  getBloodStatistics,
};
