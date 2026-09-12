const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const isObjectId = value => mongoose.Types.ObjectId.isValid(value);

const createBloodRequestRules = [
  body('patientName').trim().notEmpty().withMessage('Patient name is required'),
  body('bloodGroup')
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Valid blood group is required (A+, A-, B+, B-, AB+, AB-, O+, O-)'),
  body('bloodComponent')
    .optional()
    .isIn(['Whole Blood', 'Packed RBC', 'Platelets', 'Plasma', 'Cryoprecipitate'])
    .withMessage('Valid blood component is required'),
  body('quantity')
    .isInt({ min: 1, max: 20 })
    .withMessage('Quantity must be an integer between 1 and 20 units'),
  body('urgency')
    .optional()
    .isIn(['Normal', 'Urgent', 'Emergency', 'normal', 'urgent', 'emergency'])
    .withMessage('Urgency must be Normal, Urgent, or Emergency'),
  body('targetHospitals')
    .isArray({ min: 1 })
    .withMessage('At least one target hospital/blood bank must be selected'),
  body('targetHospitals.*').custom(isObjectId).withMessage('Invalid target hospital ID'),
  body('contactPhone').trim().notEmpty().withMessage('Contact phone number is required'),
];

const updateInventoryRules = [
  body('hospitalId').custom(isObjectId).withMessage('Valid hospital ID is required'),
  body('bloodGroup')
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Valid blood group is required'),
  body('component')
    .isIn(['Whole Blood', 'Packed RBC', 'Platelets', 'Plasma', 'Cryoprecipitate'])
    .withMessage('Valid component is required'),
  body('totalUnits').isInt({ min: 0 }).withMessage('Total units cannot be negative'),
];

const registerDonorRules = [
  body('name').trim().notEmpty().withMessage('Donor name is required'),
  body('age').isInt({ min: 18, max: 65 }).withMessage('Donor age must be between 18 and 65 years'),
  body('bloodGroup')
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Valid blood group is required'),
  body('phone').trim().notEmpty().withMessage('Contact phone is required'),
  body('district').trim().notEmpty().withMessage('District is required'),
  body('city').trim().notEmpty().withMessage('City/Area is required'),
];

const rejectBloodRequestRules = [
  param('id').custom(isObjectId).withMessage('Invalid request ID'),
  body('reason').trim().notEmpty().withMessage('Rejection reason is mandatory'),
];

const partialAcceptBloodRequestRules = [
  param('id').custom(isObjectId).withMessage('Invalid request ID'),
  body('availableUnits')
    .isInt({ min: 1 })
    .withMessage('Partially available units must be at least 1'),
];

module.exports = {
  createBloodRequestRules,
  updateInventoryRules,
  registerDonorRules,
  rejectBloodRequestRules,
  partialAcceptBloodRequestRules,
};
