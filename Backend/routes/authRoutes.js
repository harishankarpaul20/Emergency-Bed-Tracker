const express = require('express');
const router = express.Router();
const { register, login, getMe, logout, refresh } = require('../controllers/authController');
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { registerRules, loginRules } = require('../validators/authValidator');

router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.get('/me', authenticate, getMe);
router.post('/refresh', refresh);
router.post('/logout', optionalAuth, logout);

module.exports = router;

