/**
 * regexUtils.js
 * Centralized utility for regular expression query safety.
 */

/**
 * Safely escapes all regular expression special characters in user input.
 * Ensures user search input is treated as literal search text rather than
 * executable regex syntax, preventing ReDoS and NoSQL regex injection.
 *
 * @param {string} str - Raw user input string
 * @returns {string} Escaped string safe for RegExp construction
 */
function escapeRegex(str) {
  if (str == null) return '';
  const s = typeof str === 'string' ? str : String(str);
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  escapeRegex,
};
