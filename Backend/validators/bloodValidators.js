const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const isObjectId = value => mongoose.Types.ObjectId.isValid(value);

const createBloodRequestRules = [
  body().custom(bodyData => {
    const patientName = bodyData.patient?.name || bodyData.patientName;
    if (!patientName || !String(patientName).trim()) {
      throw new Error('Patient name is required');
    }

    const bloodGroup = bodyData.bloodRequirement?.bloodGroup || bodyData.bloodGroup;
    if (!bloodGroup || !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodGroup)) {
      throw new Error('Valid blood group is required (A+, A-, B+, B-, AB+, AB-, O+, O-)');
    }

    const qty = bodyData.bloodRequirement?.quantity !== undefined ? bodyData.bloodRequirement.quantity : bodyData.quantity;
    const parsedQty = parseInt(qty, 10);
    if (isNaN(parsedQty) || parsedQty < 1 || parsedQty > 50) {
      throw new Error('Quantity must be an integer between 1 and 50 units');
    }

    const targetHospitals = bodyData.targetHospitals;
    if (!targetHospitals || !Array.isArray(targetHospitals) || targetHospitals.length === 0) {
      throw new Error('At least one target hospital/blood bank must be selected');
    }
    for (const h of targetHospitals) {
      if (!isObjectId(h)) {
        throw new Error('Invalid target hospital ID: ' + h);
      }
    }

    const contact = bodyData.patient?.contactPhone || bodyData.requester?.contact || bodyData.contactPhone;
    if (!contact || !String(contact).trim()) {
      throw new Error('Emergency contact phone number is required');
    }

    return true;
  }),
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
