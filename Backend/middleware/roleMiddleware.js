const Hospital = require('../models/Hospital');

/**
 * Restricts access to specified roles (e.g. 'super_admin', 'hospital_admin')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required for this resource.',
        errors: [],
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized to access this route.`,
        errors: [],
      });
    }

    next();
  };
};

/**
 * Convenience middlewares
 */
const superAdminOnly = authorize('super_admin');
const hospitalAdminOrSuper = authorize('hospital_admin', 'super_admin');

/**
 * Ensures that a hospital_admin can only manage their own hospital.
 * Super admins have global access.
 */
const verifyHospitalOwnership = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      errors: [],
    });
  }

  // Super admin has unrestricted access to all hospitals
  if (req.user.role === 'super_admin') {
    return next();
  }

  if (req.user.role !== 'hospital_admin') {
    return res.status(403).json({
      success: false,
      message: 'Only hospital administrators or super administrators can modify hospital records.',
      errors: [],
    });
  }

  // Determine target hospital ID from params, body, or bed record
  const targetHospitalId = req.params.hospitalId || req.params.id || req.targetHospitalId;

  if (!targetHospitalId) {
    return res.status(400).json({
      success: false,
      message: 'Target hospital identifier is missing.',
      errors: [],
    });
  }

  try {
    // Check if user's assigned hospital matches target, or user is admin of target hospital
    const hospital = await Hospital.findById(targetHospitalId);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found.',
        errors: [],
      });
    }

    const userHospitalId = req.user.hospital ? req.user.hospital.toString() : null;
    const hospitalAdminId = hospital.admin ? hospital.admin.toString() : null;
    const currentUserId = req.user._id.toString();

    const isAuthorized =
      (userHospitalId && userHospitalId === hospital._id.toString()) ||
      (hospitalAdminId && hospitalAdminId === currentUserId);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only manage resources for your own hospital.',
        errors: [],
      });
    }

    req.hospital = hospital;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Pure authorization check for hospital resource access
 * Super admin has global access; hospital admin is strictly limited to their own hospital.
 */
function isUserAdminForHospital(user, targetHospitalId) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'hospital_admin') {
    const userHospId = (user.hospitalId || (user.hospital && user.hospital._id ? user.hospital._id : user.hospital))?.toString();
    const targetId = (targetHospitalId && targetHospitalId._id ? targetHospitalId._id : targetHospitalId)?.toString();
    return Boolean(userHospId && targetId && userHospId === targetId);
  }
  return false;
}

module.exports = {
  authorize,
  superAdminOnly,
  hospitalAdminOrSuper,
  verifyHospitalOwnership,
  isUserAdminForHospital,
};
