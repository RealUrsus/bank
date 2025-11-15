/**
 * Filters items by status parameter
 * @param {Array} allItems - All items to filter
 * @param {Array} activeItems - Pre-filtered active items
 * @param {string} status - Status filter ('all', 'active', or specific status name)
 * @returns {Array} Filtered items based on status
 */
function filterByStatus(allItems, activeItems, status) {
  if (status === 'all') {
    return allItems;
  } else if (status === 'active') {
    return activeItems;
  } else {
    // Filter by specific status name
    return allItems.filter(item =>
      item.StatusName && item.StatusName.toLowerCase() === status.toLowerCase()
    );
  }
}

module.exports = { filterByStatus };
