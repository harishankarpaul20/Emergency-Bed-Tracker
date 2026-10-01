const express = require('express');
const router = express.Router();
const {
  submitIntake,
  getIntakeById,
} = require('../controllers/emergencyController');
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { emergencyIntakeRules, intakeIdParamRule } = require('../validators/emergencyValidator');

// POST /api/emergency/intake - Submit patient emergency information and retrieve prioritized hospitals
router.post('/intake', optionalAuth, emergencyIntakeRules, validate, submitIntake);

// GET /api/emergency/intake/:id - Retrieve an intake record (Protected: Staff, Doctor, Admin, or Patient)
router.get('/intake/:id', authenticate, intakeIdParamRule, validate, getIntakeById);

module.exports = router;
