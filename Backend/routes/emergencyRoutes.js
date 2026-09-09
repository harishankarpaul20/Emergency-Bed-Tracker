const express = require('express');
const router = express.Router();
const {
  submitIntake,
  getIntakeById,
} = require('../controllers/emergencyController');
const { validate } = require('../middleware/validationMiddleware');
const { emergencyIntakeRules } = require('../validators/emergencyValidator');

// POST /api/emergency/intake - Submit patient emergency information and retrieve prioritized hospitals
router.post('/intake', emergencyIntakeRules, validate, submitIntake);

// GET /api/emergency/intake/:id - Retrieve an intake record
router.get('/intake/:id', getIntakeById);

module.exports = router;
