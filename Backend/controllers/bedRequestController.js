const BedRequest = require('../models/BedRequest');
const BloodRequest = require('../models/BloodRequest');
const Hospital = require('../models/Hospital');
const {
  createReservationRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
  completeRequest,
} = require('../services/bedRequestService');

/**
 * Check if the user is authorized to manage bed requests for a hospital
 */
function isUserAdminForHospital(user, hospitalId) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'hospital_admin') {
    const userHospId = (user.hospitalId || (user.hospital && user.hospital._id ? user.hospital._id : user.hospital))?.toString();
    const targetId = (hospitalId && hospitalId._id ? hospitalId._id : hospitalId)?.toString();
    return Boolean(userHospId && targetId && userHospId === targetId);
  }
  return false;
}

/**
 * @desc    Submit a bed reservation request
 * @route   POST /api/bed-requests
 * @access  Private
 */
const createBedRequest = async (req, res, next) => {
  try {
    const { hospitalId, bedType, patientName, contactPhone, notes } = req.body;

    const request = await createReservationRequest({
      user: req.user,
      hospitalId,
      bedType,
      patientName,
      contactPhone,
      notes,
      io: req.io,
    });

    res.status(201).json({
      success: true,
      message: 'Bed reservation request submitted successfully. 1 bed reserved pending hospital confirmation.',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get bed requests (filtered by user role)
 * @route   GET /api/bed-requests
 * @access  Private
 */
const getBedRequests = async (req, res, next) => {
  try {
    let filter = {};

    const reqType = req.query.requestType ? req.query.requestType.toUpperCase() : null;

    if (reqType === 'BLOOD') {
      const bloodFilter = {};
      if (req.user.role === 'user') {
        bloodFilter['requester.user'] = req.user._id;
      } else if (['hospital_admin', 'blood_bank_staff', 'doctor'].includes(req.user.role)) {
        const userHosp = req.user.hospitalId || req.user.hospital?._id || req.user.hospital;
        bloodFilter.$or = [
          { 'recipients.hospital': userHosp },
          { fulfillingHospital: userHosp },
          { sourceHospital: userHosp },
        ];
      }
      if (req.query.status && req.query.status !== 'all') {
        bloodFilter.status = req.query.status;
      }
      const bloodReqs = await BloodRequest.find(bloodFilter)
        .populate('recipients.hospital', 'name district area phone')
        .populate('fulfillingHospital', 'name district phone')
        .populate('requester.user', 'name email phone')
        .sort({ 'bloodRequirement.urgency': 1, createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: bloodReqs,
      });
    }

    if (req.user.role === 'user') {
      filter.user = req.user._id;
    } else if (req.user.role === 'hospital_admin') {
      const userHosp = req.user.hospitalId || req.user.hospital?._id || req.user.hospital;
      if (!userHosp) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'No hospital assigned to this account.',
        });
      }
      if (reqType === 'BLOOD') {
        filter.$or = [
          { hospital: userHosp },
          { targetHospitals: userHosp },
          { 'recipients.hospital': userHosp },
        ];
      } else {
        filter.hospital = userHosp;
      }
    } else if (['doctor', 'blood_bank_staff'].includes(req.user.role)) {
      const userHosp = req.user.hospitalId || req.user.hospital?._id || req.user.hospital;
      if (!userHosp) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'No hospital assigned to this account.',
        });
      }
      if (reqType === 'BLOOD') {
        filter.$or = [
          { hospital: userHosp },
          { targetHospitals: userHosp },
          { 'recipients.hospital': userHosp },
          { requestingHospital: userHosp },
        ];
      } else {
        filter.hospital = userHosp;
      }
    } else if (req.user.role === 'super_admin') {
      if (req.query.hospital) {
        if (reqType === 'BLOOD') {
          filter.$or = [
            { hospital: req.query.hospital },
            { targetHospitals: req.query.hospital },
            { 'recipients.hospital': req.query.hospital },
          ];
        } else {
          filter.hospital = req.query.hospital;
        }
      }
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.requestType && req.query.requestType !== 'all') {
      filter.requestType = req.query.requestType.toUpperCase();
    }

    const requests = await BedRequest.find(filter)
      .populate('hospital', 'name district area phone address')
      .populate('user', 'name email phone')
      .populate('targetHospitals', 'name district area phone')
      .populate('recipients.hospital', 'name district area phone')
      .populate('requestingHospital', 'name district phone')
      .populate('requestingDoctor', 'name email specialization')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single bed request by ID
 * @route   GET /api/bed-requests/:id
 * @access  Private
 */
const getBedRequestById = async (req, res, next) => {
  try {
    const request = await BedRequest.findById(req.params.id)
      .populate('hospital', 'name district area phone address')
      .populate('user', 'name email phone');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Bed request not found',
        errors: [],
      });
    }

    // Permission check
    const isOwner = request.user._id.toString() === req.user._id.toString();
    const isAdmin = isUserAdminForHospital(req.user, request.hospital._id);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You cannot view this bed request.',
        errors: [],
      });
    }

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve bed request
 * @route   PATCH /api/bed-requests/:id/approve
 * @access  Private/Admin
 */
const approveBedRequest = async (req, res, next) => {
  try {
    const reqDoc = await BedRequest.findById(req.params.id);
    if (!reqDoc) {
      return res.status(404).json({
        success: false,
        message: 'Bed request not found',
        errors: [],
      });
    }

    if (!isUserAdminForHospital(req.user, reqDoc.hospital)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only manage requests for your own hospital.',
        errors: [],
      });
    }

    const updated = await approveRequest(req.params.id, req.io);

    res.status(200).json({
      success: true,
      message: 'Bed request approved. Bed allocated as occupied.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject bed request
 * @route   PATCH /api/bed-requests/:id/reject
 * @access  Private/Admin
 */
const rejectBedRequest = async (req, res, next) => {
  try {
    const reqDoc = await BedRequest.findById(req.params.id);
    if (!reqDoc) {
      return res.status(404).json({
        success: false,
        message: 'Bed request not found',
        errors: [],
      });
    }

    if (!isUserAdminForHospital(req.user, reqDoc.hospital)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only manage requests for your own hospital.',
        errors: [],
      });
    }

    const updated = await rejectRequest(req.params.id, req.io);

    res.status(200).json({
      success: true,
      message: 'Bed request rejected. Bed released back to available.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel bed request (by requester or hospital admin)
 * @route   PATCH /api/bed-requests/:id/cancel
 * @access  Private
 */
const cancelBedRequest = async (req, res, next) => {
  try {
    const reqDoc = await BedRequest.findById(req.params.id);
    if (!reqDoc) {
      return res.status(404).json({
        success: false,
        message: 'Bed request not found',
        errors: [],
      });
    }

    const isOwner = reqDoc.user.toString() === req.user._id.toString();
    const isAdmin = isUserAdminForHospital(req.user, reqDoc.hospital);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only manage requests for your own hospital.',
        errors: [],
      });
    }

    const updated = await cancelRequest(req.params.id, req.io);

    res.status(200).json({
      success: true,
      message: 'Bed request cancelled. Bed released back to available inventory.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete bed request (patient discharged)
 * @route   PATCH /api/bed-requests/:id/complete
 * @access  Private/Admin
 */
const completeBedRequest = async (req, res, next) => {
  try {
    const reqDoc = await BedRequest.findById(req.params.id);
    if (!reqDoc) {
      return res.status(404).json({
        success: false,
        message: 'Bed request not found',
        errors: [],
      });
    }

    if (!isUserAdminForHospital(req.user, reqDoc.hospital)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not administer this hospital.',
        errors: [],
      });
    }

    const updated = await completeRequest(req.params.id, req.io);

    res.status(200).json({
      success: true,
      message: 'Patient marked as discharged. Bed released back to available inventory.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBedRequest,
  getBedRequests,
  getBedRequestById,
  approveBedRequest,
  rejectBedRequest,
  cancelBedRequest,
  completeBedRequest,
};
