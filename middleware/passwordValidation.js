const userService = require('../services/user.service');

/**
 * Middleware to validate password change request
 * @param {Array} requiredFields - Fields to validate (default: currentPassword, newPassword, confirmPassword)
 * @returns {Function} Express middleware
 */
function validatePasswordChange(requiredFields = ['currentPassword', 'newPassword', 'confirmPassword']) {
  return (req, res, next) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      req.session.message = 'All fields are required.';
      req.session.messageType = 'danger';
      return res.redirect('back');
    }

    const { newPassword, confirmPassword } = req.body;
    if (!userService.passwordsMatch(newPassword, confirmPassword)) {
      req.session.message = 'New passwords do not match.';
      req.session.messageType = 'danger';
      return res.redirect('back');
    }

    next();
  };
}

module.exports = {
  validatePasswordChange
};
