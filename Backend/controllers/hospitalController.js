const Hospital = require('../models/Hospital');
const Bed = require('../models/Bed');
const {
  searchHospitals,
  getNetworkStatistics,
  getDistrictBreakdown,
} = require('../services/hospitalService');
const { formatBedSummary } = require('../services/bedService');

/**
 * @desc    Get all hospitals with filtering, pagination and bed summaries
 * @route   GET /api/hospitals
 * @access  Public
 */
const getHospitals = async (req, res, next) => {
  try {
    const result = await searchHospitals(req.query);
    res.status(200).json({
      success: true,
      message: 'Hospitals retrieved successfully',
      data: result.hospitals,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single hospital by ID with full bed inventory
 * @route   GET /api/hospitals/:id
 * @access  Public
 */
const getHospitalById = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found',
        errors: [],
      });
    }

    const beds = await Bed.find({ hospital: hospital._id, isActive: true }).lean();
    const bedSummary = formatBedSummary(beds);

    res.status(200).json({
      success: true,
      data: {
        id: hospital._id.toString(),
        _id: hospital._id,
        name: hospital.name,
        registrationId: hospital.registrationId,
        description: hospital.description,
        hospitalType: hospital.hospitalType,
        address: hospital.address,
        area: hospital.area,
        district: hospital.district,
        state: hospital.state,
        pincode: hospital.pincode,
        phone: hospital.phone,
        email: hospital.email,
        website: hospital.website,
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        verified: hospital.isVerified,
        isActive: hospital.isActive,
        facilities: hospital.facilities,
        createdAt: hospital.createdAt,
        updatedAt: hospital.updatedAt,
        ...bedSummary,
        beds: beds, // Full bed list
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get state-wide network statistics
 * @route   GET /api/hospitals/statistics
 * @access  Public
 */
const getStatistics = async (req, res, next) => {
  try {
    const stats = await getNetworkStatistics();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get West Bengal district breakdown with hospital counts
 * @route   GET /api/hospitals/districts
 * @access  Public
 */
const getDistricts = async (req, res, next) => {
  try {
    const districts = await getDistrictBreakdown();
    res.status(200).json({
      success: true,
      data: districts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new hospital
 * @route   POST /api/hospitals
 * @access  Private/SuperAdmin
 */
const createHospital = async (req, res, next) => {
  try {
    const {
      name,
      registrationId,
      description,
      hospitalType,
      address,
      area,
      district,
      state,
      pincode,
      phone,
      email,
      website,
      latitude,
      longitude,
      facilities,
      isVerified,
    } = req.body;

    const hospital = await Hospital.create({
      name,
      registrationId,
      description,
      hospitalType: hospitalType || 'private',
      address,
      area,
      district,
      state: state || 'West Bengal',
      pincode,
      phone,
      email,
      website,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      facilities: facilities || ['Emergency Department', 'Oxygen Support'],
      isVerified: Boolean(isVerified),
    });

    // Automatically initialize the 4 standard bed categories for the new hospital
    const defaultCategories = ['general', 'icu', 'oxygen', 'ventilator'];
    for (const cat of defaultCategories) {
      await Bed.create({
        hospital: hospital._id,
        type: cat,
        totalBeds: 10,
        occupiedBeds: 0,
        reservedBeds: 0,
        availableBeds: 10,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Hospital created successfully with initialized bed categories',
      data: hospital,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update hospital details
 * @route   PUT /api/hospitals/:id
 * @access  Private/Admin
 */
const updateHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found',
        errors: [],
      });
    }

    // Explicit allowed fields
    const allowedFields = [
      'name',
      'description',
      'hospitalType',
      'address',
      'area',
      'district',
      'state',
      'pincode',
      'phone',
      'email',
      'website',
      'latitude',
      'longitude',
      'facilities',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        hospital[field] = req.body[field];
      }
    }

    if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
      hospital.location = {
        type: 'Point',
        coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)],
      };
    }

    await hospital.save();

    res.status(200).json({
      success: true,
      message: 'Hospital updated successfully',
      data: hospital,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete hospital
 * @route   DELETE /api/hospitals/:id
 * @access  Private/SuperAdmin
 */
const deleteHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found',
        errors: [],
      });
    }

    // Deactivate hospital & associated beds
    hospital.isActive = false;
    await hospital.save();
    await Bed.updateMany({ hospital: hospital._id }, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Hospital deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle hospital verification
 * @route   PATCH /api/hospitals/:id/verify
 * @access  Private/SuperAdmin
 */
const toggleVerifyHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found',
        errors: [],
      });
    }

    hospital.isVerified = req.body.isVerified !== undefined ? req.body.isVerified : !hospital.isVerified;
    await hospital.save();

    res.status(200).json({
      success: true,
      message: `Hospital verification status updated to ${hospital.isVerified}`,
      data: hospital,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle hospital active status
 * @route   PATCH /api/hospitals/:id/status
 * @access  Private/SuperAdmin
 */
const toggleHospitalStatus = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found',
        errors: [],
      });
    }

    hospital.isActive = req.body.isActive !== undefined ? req.body.isActive : !hospital.isActive;
    await hospital.save();

    res.status(200).json({
      success: true,
      message: `Hospital active status updated to ${hospital.isActive}`,
      data: hospital,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHospitals,
  getHospitalById,
  getStatistics,
  getDistricts,
  createHospital,
  updateHospital,
  deleteHospital,
  toggleVerifyHospital,
  toggleHospitalStatus,
};
