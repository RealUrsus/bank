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
// Usage:
// - PENDING: Loan requests, pending transactions
// - APPROVED: Approved transactions only (not used for accounts)
// - REJECTED: Rejected loan requests
// - ACTIVE: Active loans, GICs, chequing accounts, agreements
// - CLOSED: Closed/matured loans and GICs
// - PAID_OFF: Fully paid off loans
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

// Payment Frequencies
const PAYMENT_FREQUENCIES = {
  BI_WEEKLY: 0,
  MONTHLY: 1,
  ANNUALLY: 2,
  AT_MATURITY: 3
};

const PAYMENT_FREQUENCY_NAMES = {
  0: 'Bi-weekly',
  1: 'Monthly',
  2: 'Annually',
  3: 'At Maturity'
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
  'Cosmetics',
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

// Financial Configuration
const FINANCIAL_CONFIG = {
  // Rounding tolerance for financial calculations (in dollars)
  ROUNDING_TOLERANCE: 0.01,
  // Interest calculation methods
  LOAN_INTEREST_TYPE: 'simple',
  GIC_INTEREST_TYPE: 'compound',
  GIC_COMPOUNDING_FREQUENCY: 12, // Monthly compounding
  // Days per month for accrual calculations
  AVG_DAYS_PER_MONTH: 30.44
};

module.exports = {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_NAMES,
  ROLES,
  ROLE_NAMES,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_NAMES,
  STATUS,
  STATUS_NAMES,
  PAYMENT_FREQUENCIES,
  PAYMENT_FREQUENCY_NAMES,
  PASSWORD_CONFIG,
  DATE_CONFIG,
  TRANSACTION_CATEGORIES,
  FINANCIAL_CONFIG
};
