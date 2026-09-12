const express = require('express');
const router = express.Router();

const {
  createBloodRequest,
  getBloodRequests,
  getBloodRequestById,
  getMyBloodRequests,
  acceptBloodRequest,
  partiallyAcceptBloodRequest,
  rejectBloodRequest,
  cancelBloodRequest,
  completeBloodRequest,
} = require('../controllers/bloodRequestController');

const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const {
  createBloodRequestRules,
  rejectBloodRequestRules,
  partialAcceptBloodRequestRules,
} = require('../validators/bloodValidators');

router.post('/', optionalAuth, createBloodRequestRules, validate, createBloodRequest);
router.get('/', authenticate, getBloodRequests);
router.get('/my-requests', authenticate, getMyBloodRequests);
router.get('/:id', authenticate, getBloodRequestById);

router.post('/:id/accept', authenticate, acceptBloodRequest);
router.post('/:id/partial-accept', authenticate, partialAcceptBloodRequestRules, validate, partiallyAcceptBloodRequest);
router.post('/:id/reject', authenticate, rejectBloodRequestRules, validate, rejectBloodRequest);
router.post('/:id/cancel', authenticate, cancelBloodRequest);
router.post('/:id/complete', authenticate, completeBloodRequest);

module.exports = router;
