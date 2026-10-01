const logger = require('../utils/logger');

/**
 * 404 Not Found Middleware
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    errors: [],
  });
};

/**
 * Global Centralized Error Handler
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';
  let errors = [];

  // Log error internally
  logger.error(`${req.method} ${req.originalUrl} - ${message}`, err);

  // Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid identifier format for field '${err.path}'`;
    errors = [{ field: err.path, message }];
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
  }

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    message = `A record with ${field} '${value}' already exists.`;
    errors = [{ field, message }];
  }

  // Mongoose VersionError (Optimistic Concurrency Control)
  if (err.name === 'VersionError') {
    statusCode = 409;
    message = 'Conflict: Stale record update detected. The document was modified by another operation. Please refresh and retry.';
    errors = [{ field: 'version', message }];
  }

  // JSON Syntax Error in request body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON in request body.';
    errors = [{ field: 'body', message }];
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please authenticate.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired. Please log in again.';
  }

  // Mask internal 500 server error details in production to prevent leaking sensitive system info
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal server error occurred. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  notFound,
  errorHandler,
};
