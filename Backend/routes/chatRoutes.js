const express = require('express');
const router = express.Router();
const { handleChat } = require('../controllers/chatController');
const { validate } = require('../middleware/validationMiddleware');
const { chatMessageRules } = require('../validators/chatValidator');

// POST /api/chat - Process user message with Dr. Rakshak AI
router.post('/', chatMessageRules, validate, handleChat);

module.exports = router;
