/**
 * Application logger utility.
 * Sanitizes sensitive fields (password, token, secrets, authorization header)
 * before logging.
 */

function sanitizeLogData(data) {
  if (!data || typeof data !== 'object') return data;
  const clone = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'authorization', 'secret', 'jwt'];

  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      clone[key] = '***REDACTED***';
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = sanitizeLogData(clone[key]);
    }
  }
  return clone;
}

const logger = {
  info: (msg, data = null) => {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] [INFO]: ${msg}`, sanitizeLogData(data));
    } else {
      console.log(`[${timestamp}] [INFO]: ${msg}`);
    }
  },
  warn: (msg, data = null) => {
    const timestamp = new Date().toISOString();
    if (data) {
      console.warn(`[${timestamp}] [WARN]: ${msg}`, sanitizeLogData(data));
    } else {
      console.warn(`[${timestamp}] [WARN]: ${msg}`);
    }
  },
  error: (msg, error = null) => {
    const timestamp = new Date().toISOString();
    if (error && error.stack) {
      console.error(`[${timestamp}] [ERROR]: ${msg}\n${error.stack}`);
    } else if (error) {
      console.error(`[${timestamp}] [ERROR]: ${msg}`, sanitizeLogData(error));
    } else {
      console.error(`[${timestamp}] [ERROR]: ${msg}`);
    }
  }
};

module.exports = logger;
