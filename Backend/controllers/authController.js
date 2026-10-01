const User = require('../models/User');
const Hospital = require('../models/Hospital');
const RefreshToken = require('../models/RefreshToken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const generateToken = require('../utils/generateToken');

const isProduction = process.env.NODE_ENV === 'production';

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  ...(isProduction ? { partitioned: true } : {}),
});

const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/api/auth',
  ...(isProduction ? { partitioned: true } : {}),
});

/**
 * Creates authenticated session: short-lived access token, persisted refresh token hash, and CSRF token
 */
async function issueSession(user, res) {
  const accessToken = generateToken(user._id, user.role);

  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const csrfToken = crypto.randomBytes(24).toString('hex');

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    csrfToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.cookie('medbed_refresh_token', rawRefreshToken, getRefreshCookieOptions());

  return {
    accessToken,
    csrfToken,
    userPayload: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      hospital: user.hospital,
      hospitalId: user.hospital
        ? (user.hospital._id ? user.hospital._id.toString() : user.hospital.toString())
        : null,
    },
  };
}

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if email already registered
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
        errors: [{ field: 'email', message: 'Email is already registered' }],
      });
    }

    // Security Enforcement: Public registration strictly creates standard citizen accounts with role 'user'.
    // Privileged accounts (hospital_admin, doctor, blood_bank_staff, super_admin) must be provisioned
    // through authorized administrative endpoints (e.g. POST /api/admin/staff).
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash: password, // Pre-save hook hashes this
      phone,
      role: 'user',
    });

    const { accessToken, csrfToken, userPayload } = await issueSession(user, res);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token: accessToken,
        csrfToken,
        user: userPayload,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password, hospitalId } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .populate('hospital', 'name district area address');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        errors: [],
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact support.',
        errors: [],
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        errors: [],
      });
    }

    // Hospital validation for hospital_admin accounts
    if (user.role === 'hospital_admin' && hospitalId) {
      const isValidMongoId = mongoose.Types.ObjectId.isValid(hospitalId);
      let hospitalExists = false;
      if (isValidMongoId) {
        hospitalExists = await Hospital.exists({ _id: hospitalId });
      }

      if (!hospitalExists) {
        return res.status(404).json({
          success: false,
          message: 'Selected hospital does not exist.',
          errors: [{ field: 'hospitalId', message: 'Hospital not found in database' }],
        });
      }

      const userHospId = user.hospital
        ? (user.hospital._id ? user.hospital._id.toString() : user.hospital.toString())
        : null;

      if (!userHospId || userHospId !== hospitalId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Hospital selection does not match this staff account.',
          errors: [{ field: 'hospitalId', message: 'Selected hospital does not match user account' }],
        });
      }
    }

    const { accessToken, csrfToken, userPayload } = await issueSession(user, res);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token: accessToken,
        csrfToken,
        user: userPayload,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh access token using HttpOnly refresh cookie or body token
 * @route   POST /api/auth/refresh
 * @access  Public (Credentials / Refresh Token)
 */
const refresh = async (req, res, next) => {
  try {
    const rawRefreshToken =
      req.cookies?.medbed_refresh_token ||
      req.body?.refreshToken;

    if (!rawRefreshToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided. Please log in again.',
        errors: [],
      });
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    const tokenRecord = await RefreshToken.findOne({ tokenHash });

    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token. Please log in again.',
        errors: [],
      });
    }

    // Replay detection: if token was revoked, revoke all tokens for this user for security
    if (tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
      await RefreshToken.updateMany(
        { user: tokenRecord.user, revoked: false },
        { revoked: true, revokedAt: new Date() }
      );
      res.clearCookie('medbed_refresh_token', getClearCookieOptions());
      return res.status(401).json({
        success: false,
        message: 'Refresh token has expired or been revoked. Please log in again.',
        errors: [],
      });
    }

    // CSRF verification when refresh token originates from cookie
    const isFromCookie = Boolean(req.cookies?.medbed_refresh_token);
    if (isFromCookie) {
      const clientCsrf =
        req.headers['x-csrf-token'] ||
        req.headers['x-xsrf-token'] ||
        req.body?.csrfToken;

      if (!clientCsrf || clientCsrf !== tokenRecord.csrfToken) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or missing CSRF token for refresh request.',
          errors: [],
        });
      }
    }

    const user = await User.findById(tokenRecord.user).populate(
      'hospital',
      'name district area address'
    );

    if (!user || !user.isActive) {
      tokenRecord.revoked = true;
      tokenRecord.revokedAt = new Date();
      await tokenRecord.save();
      res.clearCookie('medbed_refresh_token', getClearCookieOptions());
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated or no longer exists.',
        errors: [],
      });
    }

    // Token Rotation: revoke current refresh token and link replacement
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = crypto
      .createHash('sha256')
      .update(newRawRefreshToken)
      .digest('hex');
    const newCsrfToken = crypto.randomBytes(24).toString('hex');

    tokenRecord.revoked = true;
    tokenRecord.revokedAt = new Date();
    tokenRecord.replacedByTokenHash = newTokenHash;
    await tokenRecord.save();

    await RefreshToken.create({
      user: user._id,
      tokenHash: newTokenHash,
      csrfToken: newCsrfToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const newAccessToken = generateToken(user._id, user.role);

    res.cookie('medbed_refresh_token', newRawRefreshToken, getRefreshCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newAccessToken,
        csrfToken: newCsrfToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          hospital: user.hospital,
          hospitalId: user.hospital
            ? (user.hospital._id ? user.hospital._id.toString() : user.hospital.toString())
            : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'hospital',
      'name district area address'
    );

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        hospital: user.hospital,
        hospitalId: user.hospital ? (user.hospital._id ? user.hospital._id.toString() : user.hospital.toString()) : null,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user (server-side session revocation & cookie removal)
 * @route   POST /api/auth/logout
 * @access  Public / Optional Auth
 */
const logout = async (req, res, next) => {
  try {
    const rawRefreshToken =
      req.cookies?.medbed_refresh_token ||
      req.body?.refreshToken;

    if (rawRefreshToken) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawRefreshToken)
        .digest('hex');

      await RefreshToken.updateOne(
        { tokenHash },
        { revoked: true, revokedAt: new Date() }
      );
    }

    if (req.user?._id) {
      await RefreshToken.updateMany(
        { user: req.user._id, revoked: false },
        { revoked: true, revokedAt: new Date() }
      );
    }

    res.clearCookie('medbed_refresh_token', getClearCookieOptions());

    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Session invalidated.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  getMe,
  logout,
};
