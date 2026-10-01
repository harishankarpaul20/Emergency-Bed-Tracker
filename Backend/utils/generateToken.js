const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT token for an authenticated user.
 * Stores only minimal identity payload (never sensitive passwords).
 */
const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables.');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';

  return jwt.sign(
    {
      id: userId,
      role: role,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn,
    }
  );
};

module.exports = generateToken;
