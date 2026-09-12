const Donor = require('../models/Donor');
const AuditLog = require('../models/AuditLog');

/**
 * @desc Register voluntary blood donor
 * @route POST /api/donors
 * @access Public or Authenticated
 */
const registerDonor = async (req, res, next) => {
  try {
    const { name, age, gender, bloodGroup, phone, email, district, city } = req.body;

    const donor = await Donor.create({
      name: name.trim(),
      age: parseInt(age, 10),
      gender,
      bloodGroup,
      phone: phone.trim(),
      email: email ? email.trim() : undefined,
      district: district.trim(),
      city: city.trim(),
      isAvailable: true,
      donationCount: 0,
      registeredBy: req.user ? req.user._id : undefined,
    });

    await AuditLog.create({
      user: req.user ? req.user._id : undefined,
      userName: name.trim(),
      role: req.user ? req.user.role : 'donor',
      action: 'DONOR_REGISTERED',
      resourceType: 'Donor',
      resourceId: donor._id,
      details: { bloodGroup, district: district.trim() },
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for registering as a life-saving blood donor in West Bengal!',
      data: {
        _id: donor._id,
        name: donor.name,
        bloodGroup: donor.bloodGroup,
        district: donor.district,
        city: donor.city,
        isAvailable: donor.isAvailable,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Search donors (Role-protected: contact details only visible to authorized hospital staff)
 * @route GET /api/donors/search
 * @access Private (hospital_admin, doctor, blood_bank_staff, super_admin)
 */
const searchDonors = async (req, res, next) => {
  try {
    const { bloodGroup, district, city, availableOnly } = req.query;
    const filter = {};

    if (bloodGroup && bloodGroup !== 'all') filter.bloodGroup = bloodGroup;
    if (district && district !== 'all') filter.district = new RegExp('^' + district.trim() + '$', 'i');
    if (city && city !== 'all') filter.city = new RegExp(city.trim(), 'i');
    if (availableOnly !== 'false') filter.isAvailable = true;

    // Check if user is authorized to view phone numbers
    const isAuthorizedStaff = req.user && ['hospital_admin', 'doctor', 'blood_bank_staff', 'super_admin'].includes(req.user.role);

    let query = Donor.find(filter).sort({ lastDonationDate: 1, donationCount: -1 });
    if (isAuthorizedStaff) {
      query = query.select('+phone +email');
    }

    const donors = await query.lean();

    res.status(200).json({
      success: true,
      count: donors.length,
      isAuthorizedStaff,
      data: donors,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Broadcast emergency requirement for donors
 * @route POST /api/donors/emergency-broadcast
 * @access Private (authorized hospital staff)
 */
const broadcastEmergencyRequirement = async (req, res, next) => {
  try {
    const { bloodGroup, unitsRequired, hospitalName, district, contactDetails } = req.body;

    const alert = {
      bloodGroup,
      unitsRequired: parseInt(unitsRequired, 10) || 1,
      hospitalName: hospitalName || 'Emergency Care Hospital',
      district: district || 'Kolkata',
      contactDetails: contactDetails || '112 Emergency Healthcare Dispatch',
      broadcastAt: new Date(),
    };

    if (req.io) {
      req.io.emit('emergencyDonorAlert', alert);
    }

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'EMERGENCY_DONOR_ALERT_BROADCAST',
      resourceType: 'Donor',
      details: alert,
    });

    res.status(200).json({
      success: true,
      message: '🚨 Emergency donor requirement broadcast across West Bengal network.',
      data: alert,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerDonor,
  searchDonors,
  broadcastEmergencyRequirement,
};
