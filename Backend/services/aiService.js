/**
 * =========================================================
 * DR. RAKSHAK — AI SERVICE (GROQ PROVIDER INTEGRATION)
 * =========================================================
 * Provides secure, server-side communication with the Groq API.
 * Keeps GROQ_API_KEY completely protected on the backend.
 */

const logger = require('../utils/logger');

// System prompt for Dr. Rakshak ensuring strict medical safety
const DR_RAKSHAK_SYSTEM_PROMPT = `You are Dr. Rakshak, an AI Health Assistant for the "Emergency Bed Tracker — West Bengal" platform.

IDENTITY & PRINCIPLES:
1. You are an AI assistant, NOT a human doctor. Never claim to be a licensed physician or to have personally examined the patient.
2. For any life-threatening acute emergency (severe chest pain, difficulty breathing, unconsciousness, massive trauma, stroke signs), immediately advise the user to call 112 or 102 for emergency medical services.
3. You provide helpful, educational, and navigational health assistance for West Bengal's emergency resources:
   - Hospital Bed Availability (General, ICU, Oxygen, Ventilator)
   - BloodConnect West Bengal (ABO/Rh compatible blood supplies & emergency requests)
   - 24×7 Emergency Medical Shops & Pharmacies across 23 districts
   - Emergency Patient Intake & Inter-Hospital Clinical Referral procedures
4. Do not provide definitive medical diagnoses or personalized drug prescriptions.
5. Use clear, empathetic, structured Markdown formatting (headings, bullet points, bold text). Keep urgent responses concise and actionable.`;

/**
 * Sends a chat completion request to the Groq API.
 * @param {string} userMessage - The current user inquiry.
 * @param {Array<{role: string, content: string}>} history - Previous conversation messages.
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function generateChatResponse(userMessage, history = []) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

  if (!apiKey || apiKey === 'your_groq_api_key_here' || apiKey === 'PASTE_YOUR_GROQ_KEY_HERE') {
    logger.warn('Groq API Key is not configured in environment variables.');
    return {
      success: false,
      status: 503,
      message: 'AI assistant service is currently configuring its connection. Please try again shortly or use the quick action buttons.',
    };
  }

  // Construct message array: System prompt -> Sanitized history -> Current message
  const messages = [
    { role: 'system', content: DR_RAKSHAK_SYSTEM_PROMPT }
  ];

  if (Array.isArray(history)) {
    const validHistory = history
      .filter(m => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
      .slice(-6); // Bounded to last 6 messages
    
    for (const h of validHistory) {
      messages.push({
        role: h.role,
        content: h.content.slice(0, 2000),
      });
    }
  }

  messages.push({
    role: 'user',
    content: String(userMessage).trim().slice(0, 2000),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.5,
        max_tokens: 750,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      logger.error(`Groq API Error (${response.status}):`, errorBody.error?.message || response.statusText);

      if (response.status === 429) {
        return {
          success: false,
          status: 429,
          message: 'Too many requests to the AI service. Please wait a moment and try again.',
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          status: 502,
          message: 'AI service authentication error. Please contact system administrator.',
        };
      }
      return {
        success: false,
        status: 502,
        message: 'The AI service is temporarily unavailable. Please try again.',
      };
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply || !reply.trim()) {
      return {
        success: false,
        status: 502,
        message: 'Received empty response from AI service. Please retry.',
      };
    }

    return {
      success: true,
      status: 200,
      message: reply.trim(),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      logger.warn('Groq API request timed out after 12s');
      return {
        success: false,
        status: 504,
        message: 'The AI service request took too long to respond. Please try again.',
      };
    }
    logger.error('Groq connection error:', err.message);
    return {
      success: false,
      status: 503,
      message: 'Could not connect to the AI service. Please check your network and try again.',
    };
  }
}

module.exports = {
  generateChatResponse,
  DR_RAKSHAK_SYSTEM_PROMPT,
};
