const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes: verifies JWT and attaches authenticated user to req.user
 */
const authenticate = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authorization token provided.',
      errors: [],
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_fallback_key');
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The account associated with this token no longer exists.',
        errors: [],
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
        errors: [],
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
        errors: [],
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token.',
      errors: [],
    });
  }
};

/**
 * Optional authentication: If token present and valid, attaches user; else proceeds as guest
 */
const optionalAuth = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_fallback_key');
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (user && user.isActive) {
      req.user = user;
    }
  } catch (err) {
    // Ignore error for optional auth
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
};
