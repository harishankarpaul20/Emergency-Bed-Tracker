const express = require('express');
const router = express.Router();

const {
  checkReadiness,
  createReferral,
  getReferrals,
  getReferralById,
  getDestinationHospitals,
  getDestinationDoctors,
  acceptReferral,
  rejectReferral,
  requestMoreInfo,
  updateReferral,
  markTransferred,
  markReceived,
  completeReferral,
} = require('../controllers/referralController');

const { authenticate } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const {
  normalizeReferralPayload,
  normalizeRejectionPayload,
  normalizeMoreInfoPayload,
  createReferralRules,
  rejectionRules,
  moreInfoRules,
  referralIdParamRule,
} = require('../validators/referralValidator');

// Pre-id specific subpaths (placed first to prevent /:id parameter capture)
router.get('/hospitals', authenticate, getDestinationHospitals);
router.get('/doctors', authenticate, getDestinationDoctors);
router.get('/doctors/:hospitalId', authenticate, getDestinationDoctors);
router.post('/readiness-check', authenticate, checkReadiness);

router.get('/incoming', authenticate, (req, res, next) => {
  req.referralType = 'incoming';
  req.query.type = 'incoming';
  return getReferrals(req, res, next);
});

router.get('/outgoing', authenticate, (req, res, next) => {
  req.referralType = 'outgoing';
  req.query.type = 'outgoing';
  return getReferrals(req, res, next);
});

// Core collection
router.post('/', authenticate, normalizeReferralPayload, createReferralRules, validate, createReferral);
router.get('/', authenticate, getReferrals);

// Single item routes
router.get('/:id', authenticate, referralIdParamRule, validate, getReferralById);
router.put('/:id', authenticate, referralIdParamRule, validate, updateReferral);

// State transitions (support both PATCH and POST)
router.patch('/:id/accept', authenticate, referralIdParamRule, validate, acceptReferral);
router.post('/:id/accept', authenticate, referralIdParamRule, validate, acceptReferral);

router.patch('/:id/reject', authenticate, normalizeRejectionPayload, rejectionRules, validate, rejectReferral);
router.post('/:id/reject', authenticate, normalizeRejectionPayload, rejectionRules, validate, rejectReferral);

router.patch('/:id/request-info', authenticate, normalizeMoreInfoPayload, moreInfoRules, validate, requestMoreInfo);
router.post('/:id/request-info', authenticate, normalizeMoreInfoPayload, moreInfoRules, validate, requestMoreInfo);

router.patch('/:id/update-info', authenticate, referralIdParamRule, validate, updateReferral);
router.post('/:id/update-info', authenticate, referralIdParamRule, validate, updateReferral);

router.patch('/:id/transfer', authenticate, referralIdParamRule, validate, markTransferred);
router.post('/:id/transfer', authenticate, referralIdParamRule, validate, markTransferred);

router.patch('/:id/receive', authenticate, referralIdParamRule, validate, markReceived);
router.post('/:id/receive', authenticate, referralIdParamRule, validate, markReceived);

router.patch('/:id/complete', authenticate, referralIdParamRule, validate, completeReferral);
router.post('/:id/complete', authenticate, referralIdParamRule, validate, completeReferral);

module.exports = router;
