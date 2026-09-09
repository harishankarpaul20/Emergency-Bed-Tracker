const { body, param } = require('express-validator');

const createStaffRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Staff administrator name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Staff email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('hospitalId')
    .notEmpty()
    .withMessage('Hospital ID is required')
    .isMongoId()
    .withMessage('Valid hospital ObjectId is required'),

  body('phone')
    .optional()
    .trim(),
];

const staffIdParamRule = [
  param('id')
    .isMongoId()
    .withMessage('Invalid staff member ID format'),
];

const updateStaffStatusRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid staff member ID format'),
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean value (true or false)'),
];

const updateStaffHospitalRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid staff member ID format'),
  body('hospitalId')
    .isMongoId()
    .withMessage('Valid target hospital ObjectId is required'),
];

module.exports = {
  createStaffRules,
  staffIdParamRule,
  updateStaffStatusRules,
  updateStaffHospitalRules,
};
