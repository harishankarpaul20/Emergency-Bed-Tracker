const express = require('express');
const router = express.Router();
const {
  getHospitals,
  getHospitalById,
  getStatistics,
  getDistricts,
  createHospital,
  updateHospital,
  deleteHospital,
  toggleVerifyHospital,
  toggleHospitalStatus,
} = require('../controllers/hospitalController');
const {
  getBedsByHospital,
  createBedForHospital,
} = require('../controllers/bedController');
const { authenticate } = require('../middleware/authMiddleware');
const {
  superAdminOnly,
  hospitalAdminOrSuper,
  verifyHospitalOwnership,
} = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const {
  hospitalIdParamRule,
  hospitalQueryRules,
  createHospitalRules,
  updateHospitalRules,
} = require('../validators/hospitalValidator');
const {
  createBedRules,
  hospitalIdBedRule,
} = require('../validators/bedValidator');

// Public stats & district aggregates (place before :id to prevent parameter conflict)
router.get('/statistics', getStatistics);
router.get('/districts', getDistricts);

// Hospitals collection
router.get('/', hospitalQueryRules, validate, getHospitals);
router.get('/:id', hospitalIdParamRule, validate, getHospitalById);

// Hospital Management (Admin / Super Admin)
router.post('/', authenticate, superAdminOnly, createHospitalRules, validate, createHospital);
router.put(
  '/:id',
  authenticate,
  verifyHospitalOwnership,
  updateHospitalRules,
  validate,
  updateHospital
);
router.delete('/:id', authenticate, superAdminOnly, hospitalIdParamRule, validate, deleteHospital);
router.patch(
  '/:id/verify',
  authenticate,
  superAdminOnly,
  hospitalIdParamRule,
  validate,
  toggleVerifyHospital
);
router.patch(
  '/:id/status',
  authenticate,
  superAdminOnly,
  hospitalIdParamRule,
  validate,
  toggleHospitalStatus
);

// Nested beds for hospital
router.get('/:hospitalId/beds', hospitalIdBedRule, validate, getBedsByHospital);
router.post(
  '/:hospitalId/beds',
  authenticate,
  hospitalAdminOrSuper,
  createBedRules,
  validate,
  createBedForHospital
);

module.exports = router;
