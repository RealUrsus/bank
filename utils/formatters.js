/**
 * Formatting utility functions
 */

/**
 * Format a date as 'YYYY-MM-DD'
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Format currency value
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
  return `$${parseFloat(amount).toFixed(2)}`;
}

/**
 * Parse date string to Date object
 * @param {string} dateString - Date string to parse
 * @returns {Date} Date object
 */
function parseDate(dateString) {
  return new Date(dateString);
}

module.exports = {
  formatDate,
  formatCurrency,
  parseDate
};
