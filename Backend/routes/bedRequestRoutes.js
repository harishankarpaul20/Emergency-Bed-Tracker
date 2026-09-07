const express = require('express');
const router = express.Router();
const {
  createBedRequest,
  getBedRequests,
  getBedRequestById,
  approveBedRequest,
  rejectBedRequest,
  cancelBedRequest,
  completeBedRequest,
} = require('../controllers/bedRequestController');
const { authenticate } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const {
  createBedRequestRules,
  requestIdParamRule,
} = require('../validators/bedRequestValidator');

router.post('/', authenticate, createBedRequestRules, validate, createBedRequest);
router.get('/', authenticate, getBedRequests);
router.get('/:id', authenticate, requestIdParamRule, validate, getBedRequestById);

router.patch('/:id/approve', authenticate, requestIdParamRule, validate, approveBedRequest);
router.patch('/:id/reject', authenticate, requestIdParamRule, validate, rejectBedRequest);
router.patch('/:id/cancel', authenticate, requestIdParamRule, validate, cancelBedRequest);
router.patch('/:id/complete', authenticate, requestIdParamRule, validate, completeBedRequest);

module.exports = router;
