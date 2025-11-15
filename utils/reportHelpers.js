const { formatDate } = require('./formatters');

/**
 * Build filter object for transaction reports based on query parameters
 * @param {Object} queryParams - Request query parameters
 * @returns {Object} Filter object with category, transactionType, startDate, and endDate
 */
function buildReportFilters(queryParams) {
  const { category, transactionType, startDate, endDate, timeframe } = queryParams;
  const filters = { category, transactionType };

  if (timeframe === 'all') {
    filters.startDate = null;
    filters.endDate = null;
  } else if (timeframe === 'custom' && startDate && endDate) {
    filters.startDate = startDate;
    filters.endDate = endDate;
  } else if (timeframe && timeframe.includes('-')) {
    const [year, month] = timeframe.split('-');
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    filters.startDate = formatDate(startOfMonth);
    filters.endDate = formatDate(endOfMonth);
  }

  return filters;
}

module.exports = {
  buildReportFilters
};
