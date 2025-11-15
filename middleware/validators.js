/**
 * Validation middleware using express-validator
 * Provides reusable validation chains for common operations
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to check validation results and return errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error(errors.array()[0].msg);
    error.status = 400;
    return next(error);
  }
  next();
};

/**
 * Transaction validation rules
 */
const validateTransaction = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('type')
    .notEmpty().withMessage('Transaction type is required')
    .isInt().withMessage('Invalid transaction type'),
  body('date')
    .notEmpty().withMessage('Date is required')
    .isDate().withMessage('Invalid date format')
    .custom((value) => {
      const transactionDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      transactionDate.setHours(0, 0, 0, 0);
      if (transactionDate > today) {
        throw new Error('Date cannot be in the future');
      }
      return true;
    }),
  body('category')
    .notEmpty().withMessage('Category is required'),
  handleValidationErrors
];

/**
 * Loan request validation rules
 */
const validateLoanRequest = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('interest')
    .notEmpty().withMessage('Interest rate is required')
    .isFloat({ min: 0 }).withMessage('Interest rate must be positive'),
  body('date')
    .notEmpty().withMessage('Start date is required')
    .isDate().withMessage('Invalid date format'),
  body('term')
    .notEmpty().withMessage('Term is required')
    .isInt({ min: 1 }).withMessage('Term must be at least 1 month'),
  body('description')
    .notEmpty().withMessage('Description is required')
    .trim(),
  body('paymentFrequency')
    .notEmpty().withMessage('Payment frequency is required')
    .isInt().withMessage('Invalid payment frequency'),
  handleValidationErrors
];

/**
 * Transfer validation rules
 */
const validateTransfer = [
  body('source')
    .notEmpty().withMessage('Source account is required')
    .isInt({ min: 1 }).withMessage('Invalid source account'),
  body('destination')
    .notEmpty().withMessage('Destination account is required')
    .isInt({ min: 1 }).withMessage('Invalid destination account'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  handleValidationErrors
];

/**
 * GIC purchase validation rules
 */
const validateGICPurchase = [
  param('productId')
    .isInt({ min: 1 }).withMessage('Invalid product ID'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  handleValidationErrors
];

/**
 * Password change validation rules
 */
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  handleValidationErrors
];

/**
 * ID parameter validation
 */
const validateIdParam = (paramName = 'id') => [
  param(paramName)
    .isInt({ min: 1 }).withMessage(`Invalid ${paramName}`),
  handleValidationErrors
];

/**
 * Signup validation rules
 */
const validateSignup = [
  body('username')
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
    .trim(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name')
    .notEmpty().withMessage('Name is required')
    .trim(),
  body('surname')
    .notEmpty().withMessage('Surname is required')
    .trim(),
  handleValidationErrors
];

module.exports = {
  validateTransaction,
  validateLoanRequest,
  validateTransfer,
  validateGICPurchase,
  validatePasswordChange,
  validateIdParam,
  validateSignup,
  handleValidationErrors
};
