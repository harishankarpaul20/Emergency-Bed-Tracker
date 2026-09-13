const express = require('express');
const router = express.Router();
const {
  getMedicalShops,
  getMedicalShopById,
  createMedicalShop,
  updateMedicalShop,
  deleteMedicalShop,
} = require('../controllers/medicalShopController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const {
  createMedicalShopRules,
  updateMedicalShopRules,
  medicalShopIdParamRule,
} = require('../validators/medicalShopValidator');

// Public endpoints
router.get('/', getMedicalShops);
router.get('/:id', medicalShopIdParamRule, validate, getMedicalShopById);

// Staff / Admin endpoints
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  createMedicalShopRules,
  validate,
  createMedicalShop
);

router.put(
  '/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  medicalShopIdParamRule,
  updateMedicalShopRules,
  validate,
  updateMedicalShop
);

router.delete(
  '/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  medicalShopIdParamRule,
  validate,
  deleteMedicalShop
);

module.exports = router;
