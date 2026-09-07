const express = require('express');
const router = express.Router();
const {
  getAllBeds,
  getAvailableBeds,
  updateBed,
  patchBedAvailability,
  deleteBed,
} = require('../controllers/bedController');
const { authenticate } = require('../middleware/authMiddleware');
const {
  hospitalAdminOrSuper,
  superAdminOnly,
} = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const {
  bedIdParamRule,
  updateBedRules,
  patchBedAvailabilityRules,
} = require('../validators/bedValidator');

router.get('/', getAllBeds);
router.get('/available', getAvailableBeds);

router.put('/:id', authenticate, hospitalAdminOrSuper, updateBedRules, validate, updateBed);
router.patch(
  '/:id/availability',
  authenticate,
  hospitalAdminOrSuper,
  patchBedAvailabilityRules,
  validate,
  patchBedAvailability
);
router.delete('/:id', authenticate, superAdminOnly, bedIdParamRule, validate, deleteBed);

module.exports = router;
