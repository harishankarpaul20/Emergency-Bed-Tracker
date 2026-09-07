const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT token for an authenticated user.
 * Stores only minimal identity payload (never sensitive passwords).
 */
const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET || 'dev_secret_fallback_key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: userId,
      role: role,
    },
    secret,
    {
      expiresIn,
    }
  );
};

module.exports = generateToken;
