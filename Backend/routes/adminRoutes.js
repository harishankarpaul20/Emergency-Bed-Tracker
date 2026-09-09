const express = require('express');
const router = express.Router();
const {
  getAdminHospitals,
  getStaffAdmins,
  createHospitalAdmin,
  toggleStaffStatus,
  updateStaffHospital,
} = require('../controllers/adminController');
const { authenticate } = require('../middleware/authMiddleware');
const { superAdminOnly } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const {
  createStaffRules,
  staffIdParamRule,
  updateStaffStatusRules,
  updateStaffHospitalRules,
} = require('../validators/adminValidator');

// All admin routes require Super Admin authentication
router.use(authenticate, superAdminOnly);

// Hospital list for administrative assignment & dropdown
router.get('/hospitals', getAdminHospitals);

// Staff accounts management
router.get('/staff', getStaffAdmins);
router.post('/staff', createStaffRules, validate, createHospitalAdmin);
router.patch('/staff/:id/status', updateStaffStatusRules, validate, toggleStaffStatus);
router.patch('/staff/:id/hospital', updateStaffHospitalRules, validate, updateStaffHospital);

module.exports = router;
