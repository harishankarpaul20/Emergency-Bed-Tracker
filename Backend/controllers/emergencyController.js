const { processEmergencyIntake } = require('../services/emergencyService');
const EmergencyIntake = require('../models/EmergencyIntake');

/**
 * @desc    Submit emergency patient intake and obtain prioritized hospitals
 * @route   POST /api/emergency/intake
 * @access  Public (Emergency Access)
 */
const submitIntake = async (req, res, next) => {
  try {
    const intakeResult = await processEmergencyIntake(req.body);

    res.status(201).json({
      success: true,
      message: 'Emergency intake processed successfully. Hospitals prioritized according to emergency criteria.',
      data: intakeResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Retrieve emergency intake record by ID
 * @route   GET /api/emergency/intake/:id
 * @access  Public / Diagnostic
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

    // Protect sensitive contact number in read response
    if (intake.contactNumber && intake.contactNumber.length >= 4) {
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
