/**
 * Validation utility functions
 */

/**
 * Validate and parse integer ID
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {number} Parsed integer
 * @throws {Error} If validation fails
 */
function validateId(value, fieldName = 'ID') {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`Invalid ${fieldName}`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

/**
 * Validate that a date is not in the future
 * @param {Date} date - Date to validate
 * @returns {boolean} True if valid
 * @throws {Error} If date is in the future
 */
function validateDateNotFuture(date) {
  const transactionDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  transactionDate.setHours(0, 0, 0, 0);

  if (transactionDate > today) {
    const error = new Error('Date cannot be in the future');
    error.status = 400;
    throw error;
  }
  return true;
}

/**
 * Validate required fields
 * @param {object} fields - Object with field names and values
 * @throws {Error} If any field is missing
 */
function validateRequiredFields(fields) {
  const missing = Object.entries(fields)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    const error = new Error(`Required fields missing: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
}

/**
 * Validate amount is positive number
 * @param {any} amount - Amount to validate
 * @returns {number} Parsed amount
 * @throws {Error} If validation fails
 */
function validateAmount(amount) {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    const error = new Error('Invalid amount');
    error.status = 400;
    throw error;
  }
  return parsed;
}

/**
 * Validate period is within allowed range
 * @param {any} period - Period in days
 * @param {number} maxDays - Maximum allowed days
 * @returns {number} Validated period
 * @throws {Error} If validation fails
 */
function validatePeriod(period, maxDays = 365) {
  const parsed = parseInt(period, 10);
  if (isNaN(parsed) || parsed < 0 || parsed > maxDays) {
    const error = new Error(`Invalid period. Must be between 0 and ${maxDays} days`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * Escapes HTML special characters
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeHtml(text) {
  if (typeof text !== 'string') return '';

  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'/]/g, char => htmlEscapeMap[char]);
}

module.exports = {
  validateId,
  validateDateNotFuture,
  validateRequiredFields,
  validateAmount,
  validatePeriod,
  sanitizeHtml
};
