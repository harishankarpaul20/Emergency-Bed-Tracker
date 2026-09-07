const { body, param } = require('express-validator');

const requestIdParamRule = [
  param('id')
    .isMongoId()
    .withMessage('Invalid bed request ID format'),
];

const createBedRequestRules = [
  body('hospitalId')
    .isMongoId()
    .withMessage('Valid hospital ID is required'),
  body('bedType')
    .isIn(['general', 'icu', 'oxygen', 'ventilator'])
    .withMessage('Bed type must be general, icu, oxygen, or ventilator'),
  body('patientName')
    .trim()
    .notEmpty()
    .withMessage('Patient name is required')
    .isLength({ max: 100 })
    .withMessage('Patient name cannot exceed 100 characters'),
  body('contactPhone')
    .trim()
    .notEmpty()
    .withMessage('Contact phone is required'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
];

module.exports = {
  requestIdParamRule,
  createBedRequestRules,
};
