const { body } = require('express-validator');

const chatMessageRules = [
  body('message')
    .exists({ checkFalsy: true })
    .withMessage('Message is required')
    .isString()
    .withMessage('Message must be a string')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  
  body('history')
    .optional()
    .isArray({ max: 10 })
    .withMessage('History must be an array of at most 10 messages'),

  body('history.*.role')
    .optional()
    .isIn(['user', 'assistant'])
    .withMessage('History message role must be either user or assistant'),

  body('history.*.content')
    .optional()
    .isString()
    .withMessage('History message content must be a string')
    .isLength({ max: 2000 })
    .withMessage('History message content cannot exceed 2000 characters'),
];

module.exports = { chatMessageRules };
