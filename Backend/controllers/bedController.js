const Bed = require('../models/Bed');
const Hospital = require('../models/Hospital');
const { broadcastBedUpdate } = require('../services/bedService');

/**
 * Check if the current user is authorized to manage beds for the given hospital
 */
function isUserAuthorizedForHospital(user, hospital) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'hospital_admin') {
    const userHospId = (user.hospitalId || (user.hospital && user.hospital._id ? user.hospital._id : user.hospital))?.toString();
    const hospId = (hospital && hospital._id ? hospital._id : hospital)?.toString();
    const hospAdminId = (hospital && hospital.admin && hospital.admin._id ? hospital.admin._id : hospital?.admin)?.toString();
    const currentUserId = user._id ? user._id.toString() : null;
    return (
      Boolean(userHospId && hospId && userHospId === hospId) ||
      Boolean(hospAdminId && currentUserId && hospAdminId === currentUserId)
    );
  }
  return false;
}

/**
 * @desc    Get all beds (optional filter by type or hospital)
 * @route   GET /api/beds
 * @access  Public
 */
const getAllBeds = async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.hospital) filter.hospital = req.query.hospital;
    if (req.query.type) filter.type = req.query.type;

    const beds = await Bed.find(filter).populate('hospital', 'name district area').lean();

    res.status(200).json({
      success: true,
      data: beds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all available beds (availableBeds > 0)
 * @route   GET /api/beds/available
 * @access  Public
 */
const getAvailableBeds = async (req, res, next) => {
  try {
    const beds = await Bed.find({
      availableBeds: { $gt: 0 },
      isActive: true,
    })
      .populate('hospital', 'name district area address phone latitude longitude')
      .lean();

    res.status(200).json({
      success: true,
      data: beds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get beds for a specific hospital
 * @route   GET /api/hospitals/:hospitalId/beds
 * @access  Public
 */
const getBedsByHospital = async (req, res, next) => {
  try {
    const beds = await Bed.find({
      hospital: req.params.hospitalId,
      isActive: true,
    }).lean();

    res.status(200).json({
      success: true,
      data: beds,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new bed category for hospital
 * @route   POST /api/hospitals/:hospitalId/beds
 * @access  Private/Admin
 */
const createBedForHospital = async (req, res, next) => {
  try {
    const { hospitalId } = req.params;
    const { type, totalBeds, occupiedBeds = 0, reservedBeds = 0 } = req.body;

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found',
        errors: [],
      });
    }

    if (!isUserAuthorizedForHospital(req.user, hospital)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not manage this hospital.',
        errors: [],
      });
    }

    const existing = await Bed.findOne({ hospital: hospitalId, type });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Bed category '${type}' already exists for this hospital. Use PUT to update.`,
        errors: [],
      });
    }

    const bed = await Bed.create({
      hospital: hospitalId,
      type,
      totalBeds: parseInt(totalBeds, 10),
      occupiedBeds: parseInt(occupiedBeds, 10),
      reservedBeds: parseInt(reservedBeds, 10),
    });

    // Real-time broadcast
    broadcastBedUpdate(req.io, {
      hospitalId: hospital._id.toString(),
      bedType: bed.type,
      availableBeds: bed.availableBeds,
      totalBeds: bed.totalBeds,
      occupiedBeds: bed.occupiedBeds,
      reservedBeds: bed.reservedBeds,
      lastUpdated: bed.lastUpdated,
    });

    res.status(201).json({
      success: true,
      message: 'Bed inventory category created successfully',
      data: bed,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update bed inventory (total, occupied, reserved)
 * @route   PUT /api/beds/:id
 * @access  Private/Admin
 */
const updateBed = async (req, res, next) => {
  try {
    const bed = await Bed.findById(req.params.id);
    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed record not found',
        errors: [],
      });
    }

    const hospital = await Hospital.findById(bed.hospital);
    if (!hospital || !isUserAuthorizedForHospital(req.user, hospital)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only manage beds for your own hospital.',
        errors: [],
      });
    }

    // SEC3-CONCUR-01G: OCC version check if supplied by client
    const expectedVersion = req.body.version !== undefined ? req.body.version : req.body.__v;
    if (expectedVersion !== undefined && bed.__v !== parseInt(expectedVersion, 10)) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Stale update rejected. Bed record version does not match expected version.',
        errors: [],
      });
    }

    const { totalBeds, occupiedBeds, reservedBeds } = req.body;

    const targetTotal = totalBeds !== undefined ? parseInt(totalBeds, 10) : bed.totalBeds;
    const targetOccupied = occupiedBeds !== undefined ? parseInt(occupiedBeds, 10) : bed.occupiedBeds;
    const targetReserved = reservedBeds !== undefined ? parseInt(reservedBeds, 10) : bed.reservedBeds;

    if (targetTotal < 0 || targetOccupied < 0 || targetReserved < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bed counters: counters cannot be negative.',
        errors: [],
      });
    }

    if (targetOccupied + targetReserved > targetTotal) {
      return res.status(400).json({
        success: false,
        message: `Invalid bed counters: occupiedBeds (${targetOccupied}) + reservedBeds (${targetReserved}) cannot exceed totalBeds (${targetTotal}).`,
        errors: [],
      });
    }

    bed.totalBeds = targetTotal;
    bed.occupiedBeds = targetOccupied;
    bed.reservedBeds = targetReserved;

    // Bed schema pre-validate hook enforces invariants and recalculates availableBeds.
    // optimisticConcurrency option on bedSchema ensures Mongoose validates __v on save.
    await bed.save();

    // Update hospital's lastAvailabilityUpdate
    hospital.lastAvailabilityUpdate = new Date();
    await hospital.save();

    // Real-time broadcast
    broadcastBedUpdate(req.io, {
      hospitalId: hospital._id.toString(),
      bedType: bed.type,
      availableBeds: bed.availableBeds,
      totalBeds: bed.totalBeds,
      occupiedBeds: bed.occupiedBeds,
      reservedBeds: bed.reservedBeds,
      lastUpdated: bed.lastUpdated,
    });

    res.status(200).json({
      success: true,
      message: 'Bed inventory updated successfully',
      data: bed,
    });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Stale bed counter update detected. Record was modified concurrently.',
        errors: [],
      });
    }
    next(error);
  }
};

/**
 * @desc    Quick update bed availability (occupied/reserved delta or absolute values)
 * @route   PATCH /api/beds/:id/availability
 * @access  Private/Admin
 */
const patchBedAvailability = async (req, res, next) => {
  try {
    const bed = await Bed.findById(req.params.id);
    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed record not found',
        errors: [],
      });
    }

    const hospital = await Hospital.findById(bed.hospital);
    if (!hospital || !isUserAuthorizedForHospital(req.user, hospital)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only manage beds for your own hospital.',
        errors: [],
      });
    }

    // SEC3-CONCUR-01G: Check if delta-based update is requested
    const isDelta =
      req.body.occupiedBedsDelta !== undefined ||
      req.body.occupiedDelta !== undefined ||
      req.body.reservedBedsDelta !== undefined ||
      req.body.reservedDelta !== undefined ||
      req.body.totalBedsDelta !== undefined ||
      req.body.totalDelta !== undefined;

    if (isDelta) {
      const dOcc = parseInt(req.body.occupiedBedsDelta ?? req.body.occupiedDelta ?? 0, 10) || 0;
      const dRes = parseInt(req.body.reservedBedsDelta ?? req.body.reservedDelta ?? 0, 10) || 0;
      const dTotal = parseInt(req.body.totalBedsDelta ?? req.body.totalDelta ?? 0, 10) || 0;

      const dAvail = dTotal - dOcc - dRes;
      const inc = {};
      if (dOcc !== 0) inc.occupiedBeds = dOcc;
      if (dRes !== 0) inc.reservedBeds = dRes;
      if (dTotal !== 0) inc.totalBeds = dTotal;
      if (dAvail !== 0) inc.availableBeds = dAvail;
      inc.__v = 1;

      // Atomic conditional update using MongoDB $inc with $expr invariant guard
      // Enforces invariants at database level:
      // occupiedBeds + dOcc >= 0
      // reservedBeds + dRes >= 0
      // totalBeds + dTotal >= 0
      // (occupiedBeds + dOcc) + (reservedBeds + dRes) <= totalBeds + dTotal
      const updatedBed = await Bed.findOneAndUpdate(
        {
          _id: bed._id,
          $expr: {
            $and: [
              { $gte: [{ $add: ['$occupiedBeds', dOcc] }, 0] },
              { $gte: [{ $add: ['$reservedBeds', dRes] }, 0] },
              { $gte: [{ $add: ['$totalBeds', dTotal] }, 0] },
              {
                $lte: [
                  { $add: [{ $add: ['$occupiedBeds', dOcc] }, { $add: ['$reservedBeds', dRes] }] },
                  { $add: ['$totalBeds', dTotal] },
                ],
              },
            ],
          },
        },
        {
          $inc: inc,
          $set: { lastUpdated: new Date() },
        },
        { returnDocument: 'after' }
      );

      if (!updatedBed) {
        return res.status(400).json({
          success: false,
          message: 'Capacity or counter invariant violated: counters cannot be negative and occupied + reserved cannot exceed total beds.',
          errors: [],
        });
      }

      hospital.lastAvailabilityUpdate = new Date();
      await hospital.save();

      broadcastBedUpdate(req.io, {
        hospitalId: hospital._id.toString(),
        bedType: updatedBed.type,
        availableBeds: updatedBed.availableBeds,
        totalBeds: updatedBed.totalBeds,
        occupiedBeds: updatedBed.occupiedBeds,
        reservedBeds: updatedBed.reservedBeds,
        lastUpdated: updatedBed.lastUpdated,
      });

      return res.status(200).json({
        success: true,
        message: 'Bed availability updated successfully',
        data: updatedBed,
      });
    }

    // SEC3-CONCUR-01G: Absolute value update with OCC version check
    const expectedVersion = req.body.version !== undefined ? req.body.version : req.body.__v;
    if (expectedVersion !== undefined && bed.__v !== parseInt(expectedVersion, 10)) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Stale update rejected. Bed record version does not match expected version.',
        errors: [],
      });
    }

    const targetTotal = req.body.totalBeds !== undefined ? parseInt(req.body.totalBeds, 10) : bed.totalBeds;
    const targetOccupied = req.body.occupiedBeds !== undefined ? parseInt(req.body.occupiedBeds, 10) : bed.occupiedBeds;
    const targetReserved = req.body.reservedBeds !== undefined ? parseInt(req.body.reservedBeds, 10) : bed.reservedBeds;

    if (targetTotal < 0 || targetOccupied < 0 || targetReserved < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bed counters: counters cannot be negative.',
        errors: [],
      });
    }

    if (targetOccupied + targetReserved > targetTotal) {
      return res.status(400).json({
        success: false,
        message: `Invalid bed counters: occupiedBeds (${targetOccupied}) + reservedBeds (${targetReserved}) cannot exceed totalBeds (${targetTotal}).`,
        errors: [],
      });
    }

    bed.occupiedBeds = targetOccupied;
    bed.reservedBeds = targetReserved;
    bed.totalBeds = targetTotal;

    // Save with Mongoose OCC protection
    await bed.save();

    hospital.lastAvailabilityUpdate = new Date();
    await hospital.save();

    broadcastBedUpdate(req.io, {
      hospitalId: hospital._id.toString(),
      bedType: bed.type,
      availableBeds: bed.availableBeds,
      totalBeds: bed.totalBeds,
      occupiedBeds: bed.occupiedBeds,
      reservedBeds: bed.reservedBeds,
      lastUpdated: bed.lastUpdated,
    });

    res.status(200).json({
      success: true,
      message: 'Bed availability updated successfully',
      data: bed,
    });
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Stale bed counter update detected. Record was modified concurrently.',
        errors: [],
      });
    }
    next(error);
  }
};

/**
 * @desc    Delete a bed category from hospital
 * @route   DELETE /api/beds/:id
 * @access  Private/SuperAdmin
 */
const deleteBed = async (req, res, next) => {
  try {
    const bed = await Bed.findById(req.params.id);
    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed record not found',
        errors: [],
      });
    }

    await Bed.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Bed record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllBeds,
  getAvailableBeds,
  getBedsByHospital,
  createBedForHospital,
  updateBed,
  patchBedAvailability,
  deleteBed,
};
