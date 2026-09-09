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

    const { totalBeds, occupiedBeds, reservedBeds } = req.body;

    if (totalBeds !== undefined) bed.totalBeds = parseInt(totalBeds, 10);
    if (occupiedBeds !== undefined) bed.occupiedBeds = parseInt(occupiedBeds, 10);
    if (reservedBeds !== undefined) bed.reservedBeds = parseInt(reservedBeds, 10);

    // Bed schema pre-validate hook enforces:
    // occupied + reserved <= total, and recalculates availableBeds
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
    next(error);
  }
};

/**
 * @desc    Quick update bed availability (occupied/reserved delta)
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

    if (req.body.occupiedBeds !== undefined) {
      bed.occupiedBeds = parseInt(req.body.occupiedBeds, 10);
    }
    if (req.body.reservedBeds !== undefined) {
      bed.reservedBeds = parseInt(req.body.reservedBeds, 10);
    }
    if (req.body.totalBeds !== undefined) {
      bed.totalBeds = parseInt(req.body.totalBeds, 10);
    }

    await bed.save();

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
