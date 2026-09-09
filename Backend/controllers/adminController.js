const User = require('../models/User');
const Hospital = require('../models/Hospital');

/**
 * @desc    Get dynamic list of hospitals for admin selection
 * @route   GET /api/admin/hospitals
 * @access  Private (Super Admin)
 */
const getAdminHospitals = async (req, res, next) => {
  try {
    const hospitals = await Hospital.find({ isActive: true })
      .select('name district area address isVerified')
      .sort({ name: 1 })
      .lean();

    const count = await Hospital.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      count,
      data: hospitals.map(h => ({
        id: h._id,
        _id: h._id,
        name: h.name,
        district: h.district,
        area: h.area,
        address: h.address,
        isVerified: h.isVerified,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all staff administrators
 * @route   GET /api/admin/staff
 * @access  Private (Super Admin)
 */
const getStaffAdmins = async (req, res, next) => {
  try {
    const staff = await User.find({ role: { $in: ['hospital_admin', 'super_admin'] } })
      .populate('hospital', 'name district area address')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: staff.length,
      data: staff.map(u => ({
        id: u._id,
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        hospital: u.hospital,
        hospitalId: u.hospital ? (u.hospital._id ? u.hospital._id.toString() : u.hospital.toString()) : null,
        isActive: u.isActive,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new hospital administrator
 * @route   POST /api/admin/staff
 * @access  Private (Super Admin)
 */
const createHospitalAdmin = async (req, res, next) => {
  try {
    const { name, email, password, hospitalId, phone } = req.body;

    // 1. Verify hospitalId exists in MongoDB Hospital collection
    const hospital = await Hospital.findOne({ _id: hospitalId, isActive: true });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Specified hospital was not found or is currently inactive.',
        errors: [{ field: 'hospitalId', message: 'Hospital not found in database' }],
      });
    }

    // 2. Prevent duplicate accounts by email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A staff or user account with this email address already exists.',
        errors: [{ field: 'email', message: 'Email already registered' }],
      });
    }

    // 3. Create hospital admin user (pre-save hook hashes password with bcrypt)
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash: password,
      phone: phone || '',
      role: 'hospital_admin',
      hospital: hospital._id,
      isActive: true,
    });

    // Populate hospital details for immediate UI response
    await newUser.populate('hospital', 'name district area address');

    res.status(201).json({
      success: true,
      message: `Hospital administrator '${newUser.name}' created successfully for ${hospital.name}.`,
      data: {
        id: newUser._id,
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        hospital: newUser.hospital,
        hospitalId: hospital._id.toString(),
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle staff active status (activate/deactivate)
 * @route   PATCH /api/admin/staff/:id/status
 * @access  Private (Super Admin)
 */
const toggleStaffStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found.',
        errors: [],
      });
    }

    // Prevent deactivating own account
    if (user._id.toString() === req.user._id.toString() && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own active super administrator account.',
        errors: [],
      });
    }

    user.isActive = Boolean(isActive);
    await user.save();
    await user.populate('hospital', 'name district area address');

    res.status(200).json({
      success: true,
      message: `Staff account ${user.name} is now ${user.isActive ? 'active' : 'deactivated'}.`,
      data: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospital: user.hospital,
        hospitalId: user.hospital ? user.hospital._id.toString() : null,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reassign a staff administrator to another existing hospital
 * @route   PATCH /api/admin/staff/:id/hospital
 * @access  Private (Super Admin)
 */
const updateStaffHospital = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hospitalId } = req.body;

    const targetHospital = await Hospital.findOne({ _id: hospitalId, isActive: true });
    if (!targetHospital) {
      return res.status(404).json({
        success: false,
        message: 'Target hospital not found or inactive.',
        errors: [{ field: 'hospitalId', message: 'Hospital not found' }],
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found.',
        errors: [],
      });
    }

    user.hospital = targetHospital._id;
    await user.save();
    await user.populate('hospital', 'name district area address');

    res.status(200).json({
      success: true,
      message: `Staff admin ${user.name} reassigned to ${targetHospital.name}.`,
      data: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospital: user.hospital,
        hospitalId: targetHospital._id.toString(),
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminHospitals,
  getStaffAdmins,
  createHospitalAdmin,
  toggleStaffStatus,
  updateStaffHospital,
};
