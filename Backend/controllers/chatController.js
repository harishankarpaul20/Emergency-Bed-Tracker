/**
 * =========================================================
 * DR. RAKSHAK CHAT CONTROLLER
 * =========================================================
 * Handles incoming chat messages from the frontend.
 */

const { generateChatResponse } = require('../services/aiService');
const logger = require('../utils/logger');

/**
 * @route   POST /api/chat
 * @desc    Process user message through Dr. Rakshak AI Assistant
 * @access  Public / Authenticated
 */
async function handleChat(req, res, next) {
  try {
    const { message, history } = req.body;

    logger.info(`💬 Chat request received (length: ${message.length} chars)`);

    const result = await generateChatResponse(message, history);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        reply: result.message,
      },
    });
  } catch (err) {
    logger.error('Unhandled error in handleChat controller:', err);
    return next(err);
  }
}

module.exports = {
  handleChat,
};
