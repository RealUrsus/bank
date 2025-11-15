/**
 * Formatting utility functions
 */

/**
 * Format a date as 'YYYY-MM-DD' in local timezone
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
