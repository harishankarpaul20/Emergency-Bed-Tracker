const { body, param } = require('express-validator');

const medicalShopIdParamRule = [
  param('id')
    .isMongoId()
    .withMessage('Invalid medical shop identifier format'),
];

const createMedicalShopRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Medical shop name is required')
    .isLength({ max: 150 })
    .withMessage('Medical shop name cannot exceed 150 characters'),

  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ max: 300 })
    .withMessage('Address cannot exceed 300 characters'),

  body('area')
    .trim()
    .notEmpty()
    .withMessage('Area or locality is required')
    .isLength({ max: 100 })
    .withMessage('Area cannot exceed 100 characters'),

  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),

  body('district')
    .trim()
    .notEmpty()
    .withMessage('District is required')
    .isLength({ max: 100 })
    .withMessage('District cannot exceed 100 characters'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[0-9+\-\s()]{7,25}$/)
    .withMessage('Please provide a valid contact phone number'),

  body('is24x7')
    .optional()
    .isBoolean()
    .withMessage('is24x7 must be a boolean value'),

  body('latitude')
    .optional({ checkFalsy: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid float between -90 and 90'),

  body('longitude')
    .optional({ checkFalsy: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid float between -180 and 180'),
];

const updateMedicalShopRules = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Medical shop name must be between 2 and 150 characters'),

  body('address')
    .optional()
    .trim()
    .isLength({ min: 5, max: 300 })
    .withMessage('Address must be between 5 and 300 characters'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]{7,25}$/)
    .withMessage('Please provide a valid contact phone number'),

  body('is24x7')
    .optional()
    .isBoolean()
    .withMessage('is24x7 must be a boolean value'),

  body('latitude')
    .optional({ checkFalsy: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('longitude')
    .optional({ checkFalsy: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
];

module.exports = {
  medicalShopIdParamRule,
  createMedicalShopRules,
  updateMedicalShopRules,
};
