const { body, param } = require('express-validator');

const bedIdParamRule = [
  param('id')
    .isMongoId()
    .withMessage('Invalid bed inventory ID format'),
];

const hospitalIdBedRule = [
  param('hospitalId')
    .isMongoId()
    .withMessage('Invalid hospital ID format'),
];

const createBedRules = [
  param('hospitalId')
    .isMongoId()
    .withMessage('Invalid hospital ID format'),
  body('type')
    .isIn(['general', 'icu', 'oxygen', 'ventilator'])
    .withMessage('Bed type must be general, icu, oxygen, or ventilator'),
  body('totalBeds')
    .isInt({ min: 0 })
    .withMessage('Total beds must be a non-negative integer'),
  body('occupiedBeds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Occupied beds must be a non-negative integer'),
  body('reservedBeds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Reserved beds must be a non-negative integer'),
];

const updateBedRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid bed inventory ID format'),
  body('totalBeds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total beds must be a non-negative integer'),
  body('occupiedBeds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Occupied beds must be a non-negative integer'),
  body('reservedBeds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Reserved beds must be a non-negative integer'),
];

const patchBedAvailabilityRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid bed inventory ID format'),
  body('occupiedBeds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Occupied beds must be a non-negative integer'),
  body('reservedBeds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Reserved beds must be a non-negative integer'),
  body('totalBeds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total beds must be a non-negative integer'),
];

module.exports = {
  bedIdParamRule,
  hospitalIdBedRule,
  createBedRules,
  updateBedRules,
  patchBedAvailabilityRules,
};
