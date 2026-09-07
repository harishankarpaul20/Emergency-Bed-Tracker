const { body, param, query } = require('express-validator');

const hospitalIdParamRule = [
  param('id')
    .isMongoId()
    .withMessage('Invalid hospital ID format'),
];

const hospitalQueryRules = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .escape(),
  query('district')
    .optional()
    .trim(),
  query('city')
    .optional()
    .trim(),
  query('bedType')
    .optional()
    .isIn(['all', 'general', 'icu', 'oxygen', 'ventilator'])
    .withMessage('Invalid bed category filter'),
  query('availability')
    .optional()
    .isIn(['all', 'available', 'limited', 'full'])
    .withMessage('Invalid availability filter'),
  query('lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  query('lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
];

const createHospitalRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Hospital name is required'),
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  body('area')
    .trim()
    .notEmpty()
    .withMessage('Area or locality is required'),
  body('district')
    .trim()
    .notEmpty()
    .withMessage('District is required'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude is required'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude is required'),
  body('hospitalType')
    .optional()
    .isIn(['government', 'private', 'public', 'specialty'])
    .withMessage('Invalid hospital type'),
  body('facilities')
    .optional()
    .isArray()
    .withMessage('Facilities must be an array of strings'),
];

const updateHospitalRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid hospital ID format'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Hospital name cannot be empty'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
];

module.exports = {
  hospitalIdParamRule,
  hospitalQueryRules,
  createHospitalRules,
  updateHospitalRules,
};
