const express = require('express');
const router = express.Router();

const {
  searchBloodAvailability,
  getBloodBanks,
  getBloodBankById,
  getInventory,
  updateInventory,
  getBloodStatistics,
} = require('../controllers/bloodBankController');

const { authenticate } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { updateInventoryRules } = require('../validators/bloodValidators');

router.get('/search', searchBloodAvailability);
router.get('/availability', searchBloodAvailability);
router.get('/statistics', getBloodStatistics);

// Specific inventory routes before parameter router.get('/:id')
router.get('/inventory/all', authenticate, getInventory);
router.post('/inventory/update', authenticate, updateInventoryRules, validate, updateInventory);
router.get('/all', authenticate, getInventory);
router.post('/update', authenticate, updateInventoryRules, validate, updateInventory);

router.get('/', getBloodBanks);
router.get('/:id', getBloodBankById);

module.exports = router;
