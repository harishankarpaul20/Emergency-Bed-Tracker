const { body } = require('express-validator');

const emergencyIntakeRules = [
  body('patientName')
    .trim()
    .notEmpty()
    .withMessage('Patient name is required')
    .isLength({ max: 100 })
    .withMessage('Patient name cannot exceed 100 characters'),

  body('age')
    .notEmpty()
    .withMessage('Age is required')
    .isInt({ min: 0, max: 120 })
    .withMessage('Age must be an integer between 0 and 120'),

  body('sex')
    .trim()
    .notEmpty()
    .withMessage('Sex is required')
    .isIn(['Male', 'Female', 'Other', 'Prefer not to say'])
    .withMessage('Sex must be Male, Female, Other, or Prefer not to say'),

  body('symptoms')
    .trim()
    .notEmpty()
    .withMessage('Symptoms description is required')
    .isLength({ max: 1000 })
    .withMessage('Symptoms description cannot exceed 1000 characters'),

  body('condition')
    .trim()
    .notEmpty()
    .withMessage('Patient condition is required')
    .isIn([
      'Very Serious / Critical',
      'Serious',
      'Moderate',
      'Stable',
      'Unknown',
    ])
    .withMessage(
      'Condition must be Very Serious / Critical, Serious, Moderate, Stable, or Unknown'
    ),

  body('emergencyType')
    .trim()
    .notEmpty()
    .withMessage('Emergency type is required')
    .isIn([
      'General Emergency',
      'Accident / Trauma',
      'Cardiac Emergency',
      'Breathing Problem',
      'Stroke Symptoms',
      'Severe Bleeding',
      'Burn',
      'Poisoning',
      'Pregnancy / Obstetric Emergency',
      'Pediatric Emergency',
      'Other',
    ])
    .withMessage('Invalid emergency type selected'),

  body('contactNumber')
    .trim()
    .notEmpty()
    .withMessage('Contact number is required')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Contact number must be a valid 10-digit Indian mobile number'),

  body('attendantName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Attendant name cannot exceed 100 characters'),

  body('ambulanceRequired')
    .optional()
    .isIn(['Yes', 'No', 'Not Sure'])
    .withMessage('Ambulance requirement must be Yes, No, or Not Sure'),

  body('additionalInformation')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Additional information cannot exceed 1000 characters'),

  body('district')
    .optional()
    .trim(),

  body('area')
    .optional()
    .trim(),
];

module.exports = {
  emergencyIntakeRules,
};
