const { validationResult } = require('express-validator');

/**
 * Middleware that inspects express-validator results
 * Returns clean 422 error response if validation failures exist
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return res.status(422).json({
      success: false,
      message: formattedErrors[0].message || 'Validation failed. Please check your inputs.',
      errors: formattedErrors,
    });
  }
  next();
};

module.exports = {
  validate,
};
