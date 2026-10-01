const { processEmergencyIntake } = require('../services/emergencyService');
const EmergencyIntake = require('../models/EmergencyIntake');

/**
 * @desc    Submit emergency patient intake and obtain prioritized hospitals
 * @route   POST /api/emergency/intake
 * @access  Public (Emergency Access)
 */
const submitIntake = async (req, res, next) => {
  try {
    console.log("EMERGENCY INTAKE ROUTE HIT");
    console.log("REQUEST RECEIVED");
    const intakePayload = { ...req.body };
    if (req.user && req.user._id) {
      intakePayload.user = req.user._id;
    }

    const intakeResult = await processEmergencyIntake(intakePayload);
    console.log("SAVE SUCCESS");

    res.status(201).json({
      success: true,
      message: 'Emergency intake processed successfully. Hospitals prioritized according to emergency criteria.',
      data: intakeResult,
    });
  } catch (error) {
    console.error("EMERGENCY INTAKE SAVE ERROR:", error);
    next(error);
  }
};

/**
 * @desc    Retrieve emergency intake record by ID
 * @route   GET /api/emergency/intake/:id
 * @access  Private (Staff, Doctor, Admin, or Intake Owner)
 */
const getIntakeById = async (req, res, next) => {
  try {
    const intake = await EmergencyIntake.findById(req.params.id)
      .populate('matchedHospitals.hospital', 'name district area phone hospitalType')
      .lean();

    if (!intake) {
      return res.status(404).json({
        success: false,
        message: 'Emergency intake record not found',
      });
    }

    // Role- and relationship-based access authorization:
    // 1. Super Admins have global administrative visibility
    // 2. Doctors have clinical access across emergency intakes
    // 3. Hospital Admins & Staff can access if their assigned hospital is matched (or if unassigned staff)
    // 4. Standard users (citizens) can ONLY access their own intake (matching user ID or matching phone)
    const user = req.user;
    const userRole = user ? user.role : null;
    let isAuthorized = false;

    if (userRole === 'super_admin' || userRole === 'doctor') {
      isAuthorized = true;
    } else if (['hospital_admin', 'blood_bank_staff'].includes(userRole)) {
      if (!user.hospital) {
        isAuthorized = true;
      } else {
        const userHospitalId = (user.hospital._id || user.hospital).toString();
        const isMatched = intake.matchedHospitals?.some((m) => {
          const hId = (m.hospital && m.hospital._id ? m.hospital._id : m.hospital)?.toString();
          return hId === userHospitalId;
        });
        isAuthorized = Boolean(isMatched);
      }
    } else if (userRole === 'user') {
      const isOwner = intake.user && intake.user.toString() === user._id.toString();
      const isPhoneMatch = Boolean(
        intake.contactNumber &&
        user.phone &&
        intake.contactNumber.replace(/\D/g, '') === user.phone.replace(/\D/g, '')
      );
      isAuthorized = isOwner || isPhoneMatch;
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to view this emergency intake record.',
        errors: [],
      });
    }

    // Protect sensitive contact number in read response unless super_admin, doctor, or owner
    const isFullAccess =
      userRole === 'super_admin' ||
      userRole === 'doctor' ||
      (intake.user && user && intake.user.toString() === user._id.toString());

    if (!isFullAccess && intake.contactNumber && intake.contactNumber.length >= 4) {
      intake.contactNumber =
        intake.contactNumber.slice(0, 2) + '******' + intake.contactNumber.slice(-2);
    }

    res.status(200).json({
      success: true,
      data: intake,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitIntake,
  getIntakeById,
};
