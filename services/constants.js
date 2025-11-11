/**
 * Constants for the banking application
 * Centralizes magic numbers and string literals
 */

// Account Types
const ACCOUNT_TYPES = {
  CHEQUING: 1,
  LOAN: 2,
  SAVING: 3,
  INVESTMENT: 4
};

const ACCOUNT_TYPE_NAMES = {
  1: 'Chequing',
  2: 'Loan',
  3: 'Saving',
  4: 'Investment'
};

// User Roles
const ROLES = {
  ADMIN: 1,
  AUDITOR: 2,
  CLIENT: 3
};

const ROLE_NAMES = {
  1: 'Admin',
  2: 'Auditor',
  3: 'Client'
};

// Transaction Types
const TRANSACTION_TYPES = {
  DEPOSIT: 1,
  WITHDRAWAL: 2,
  TRANSFER: 3
};

const TRANSACTION_TYPE_NAMES = {
  1: 'Deposit',
  2: 'Withdrawal',
  3: 'Transfer'
};

// Status Values
const STATUS = {
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3,
  ACTIVE: 4,
  CLOSED: 5,
  PAID_OFF: 6
};

const STATUS_NAMES = {
  1: 'Pending',
  2: 'Approved',
  3: 'Rejected',
  4: 'Active',
  5: 'Closed',
  6: 'Paid Off'
};

// Password Configuration
const PASSWORD_CONFIG = {
  MIN_LENGTH: 8,
  SALT_BYTES: 16,
  PBKDF2_ITERATIONS: 310000,
  HASH_LENGTH: 32,
  DIGEST: 'sha256'
};

// Date Configuration
const DATE_CONFIG = {
  DEFAULT_TRANSACTION_PERIOD_DAYS: 30,
  MAX_TRANSACTION_PERIOD_DAYS: 365
};

// Transaction Categories
const TRANSACTION_CATEGORIES = [
  'Food',
  'Beverages',
  'Grocery',
  'Entertainment',
  'Paycheck',
  'Gifts',
  'Clothes',
  'Books',
  'Education',
  'Medical',
  'Transportation',
  'Utilities',
  'Rent',
  'Insurance',
  'Savings',
  'Investment',
  'Other'
];

module.exports = {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_NAMES,
  ROLES,
  ROLE_NAMES,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_NAMES,
  STATUS,
  STATUS_NAMES,
  PASSWORD_CONFIG,
  DATE_CONFIG,
  TRANSACTION_CATEGORIES
};
