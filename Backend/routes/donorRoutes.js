const express = require('express');
const router = express.Router();

const {
  registerDonor,
  searchDonors,
  broadcastEmergencyRequirement,
} = require('../controllers/donorController');

const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { registerDonorRules } = require('../validators/bloodValidators');

router.post('/register', optionalAuth, registerDonorRules, validate, registerDonor);
router.post('/', optionalAuth, registerDonorRules, validate, registerDonor);
router.get('/search', authenticate, searchDonors);
router.get('/', authenticate, searchDonors);
router.post('/emergency-broadcast', authenticate, broadcastEmergencyRequirement);

module.exports = router;
