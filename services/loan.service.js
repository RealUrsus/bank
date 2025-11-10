/**
 * Loan service
 * Handles loan-specific business logic
 */

const db = require('./database.service');
const accountService = require('./account.service');
const transactionService = require('./transaction.service');
const financialService = require('./financial.service');
const { ACCOUNT_TYPES, STATUS, TRANSACTION_TYPES } = require('./constants');

const loanService = {
  /**
   * Get loan by ID
   * @param {number} loanId - Loan ID (Account ID)
   * @returns {Promise<object|null>} Loan record
   */
  async getLoan(loanId) {
    return await db.queryOne(
      `SELECT a.*, u.Name, u.Surname, u.UserID, s.StatusName
       FROM Accounts a
       INNER JOIN Users u ON a.UserID = u.UserID
       INNER JOIN Status s ON a.StatusID = s.StatusID
       WHERE a.AccountID = ? AND a.AccountTypeID = ?`,
      [loanId, ACCOUNT_TYPES.LOAN]
    );
  },

  /**
   * Get all loans for a user
   * @param {number} userId - User ID
   * @param {boolean} approvedOnly - Only return approved/paid off loans
   * @returns {Promise<Array>} Array of loans
   */
  async getUserLoans(userId, approvedOnly = false) {
    if (approvedOnly) {
      return await db.queryMany(
        `SELECT a.*, s.StatusName AS Status
         FROM Accounts a
         INNER JOIN Status s ON a.StatusID = s.StatusID
         WHERE a.UserID = ? AND a.AccountTypeID = ?
           AND (s.StatusName = 'Approved' OR s.StatusName = 'Paid Off')
         ORDER BY a.StartDate ASC`,
        [userId, ACCOUNT_TYPES.LOAN]
      );
    }

    return await db.queryMany(
      `SELECT a.*, u.Name, u.Surname, s.StatusName
       FROM Accounts a
       INNER JOIN Users u ON a.UserID = u.UserID
       INNER JOIN Status s ON a.StatusID = s.StatusID
       WHERE a.UserID = ? AND a.AccountTypeID = ?
       ORDER BY a.StartDate DESC`,
      [userId, ACCOUNT_TYPES.LOAN]
    );
  },

  /**
   * Get all active (approved) loans
   * Used by daily tasks for interest calculations
   * @returns {Promise<Array>} Array of active loans
   */
  async getActiveLoans() {
    return await db.queryMany(
      `SELECT * FROM Accounts
       WHERE AccountTypeID = ? AND StatusID = ?`,
      [ACCOUNT_TYPES.LOAN, STATUS.APPROVED]
    );
  },

  /**
   * Get all pending loan requests
   * @returns {Promise<Array>} Array of pending loans
   */
  async getPendingLoanRequests() {
    return await db.queryMany(
      `SELECT a.*, u.Name, u.Surname, u.UserID, s.StatusName
       FROM Accounts a
       INNER JOIN Users u ON a.UserID = u.UserID
       INNER JOIN Status s ON a.StatusID = s.StatusID
       WHERE a.AccountTypeID = ? AND a.StatusID = ?
       ORDER BY a.AccountID DESC`,
      [ACCOUNT_TYPES.LOAN, STATUS.PENDING]
    );
  },

  /**
   * Create a loan request
   * @param {object} loanData - Loan data
   * @returns {Promise<number>} New loan ID
   */
  async createLoanRequest(loanData) {
    const {
      userId,
      amount,
      interestRate,
      term,
      startDate,
      description,
      paymentFrequency
    } = loanData;

    return await accountService.createAccount({
      userId,
      accountTypeId: ACCOUNT_TYPES.LOAN,
      interestRate,
      principalAmount: amount,
      term,
      startDate,
      statusId: STATUS.PENDING,
      description,
      paymentFrequency
    });
  },

  /**
   * Approve a loan request
   * @param {number} loanId - Loan ID
   * @returns {Promise<void>}
   */
  async approveLoan(loanId) {
    await accountService.updateAccountStatus(loanId, STATUS.APPROVED);
  },

  /**
   * Deny a loan request
   * @param {number} loanId - Loan ID
   * @returns {Promise<void>}
   */
  async denyLoan(loanId) {
    await accountService.updateAccountStatus(loanId, STATUS.REJECTED);
  },

  /**
   * Update loan details
   * @param {number} loanId - Loan ID
   * @param {object} loanData - Loan data to update
   * @returns {Promise<void>}
   */
  async updateLoan(loanId, loanData) {
    await accountService.updateAccount(loanId, loanData);
  },

  /**
   * Delete a loan
   * @param {number} loanId - Loan ID
   * @returns {Promise<void>}
   */
  async deleteLoan(loanId) {
    await accountService.deleteAccount(loanId);
  },

  /**
   * Check if a loan is paid off and update status
   * @param {number} loanId - Loan ID
   * @returns {Promise<boolean>} True if loan was marked as paid off
   */
  async checkLoanPayoff(loanId) {
    const loan = await this.getLoan(loanId);
    if (!loan || loan.StatusID !== STATUS.APPROVED) {
      return false;
    }

    const balance = await accountService.getBalance(loanId);

    if (balance >= loan.PrincipalAmount) {
      await accountService.updateAccountStatus(loanId, STATUS.PAID_OFF);
      return true;
    }

    return false;
  },

  /**
   * Calculate monthly payment for a loan
   * @param {object} loan - Loan object
   * @returns {number} Monthly payment amount
   */
  calculateLoanPayment(loan) {
    return financialService.calculatePaymentByFrequency(
      loan.PrincipalAmount,
      loan.InterestRate,
      loan.Term,
      loan.PaymentFrequency
    );
  },

  /**
   * Calculate accrued interest for a loan
   * @param {object} loan - Loan object
   * @param {number} days - Number of days since last accrual
   * @returns {number} Interest amount
   */
  calculateAccruedInterest(loan, days = 1) {
    return financialService.calculateAccruedInterest(
      loan.PrincipalAmount,
      loan.InterestRate,
      days
    );
  },

  /**
   * Process daily interest for a loan
   * Creates a system transaction for interest
   * @param {number} loanId - Loan ID
   * @returns {Promise<number|null>} Transaction ID or null if not applicable
   */
  async processDailyInterest(loanId) {
    const loan = await this.getLoan(loanId);
    if (!loan || loan.StatusID !== STATUS.APPROVED) {
      return null;
    }

    const interest = this.calculateAccruedInterest(loan, 1);

    if (interest > 0) {
      const transactionId = await transactionService.createSystemTransaction({
        accountId: loanId,
        transactionTypeId: TRANSACTION_TYPES.WITHDRAWAL,
        amount: interest,
        description: `Daily interest accrual (${loan.InterestRate}% APR)`
      });

      return transactionId;
    }

    return null;
  },

  /**
   * Check loan maturity and process accordingly
   * @param {number} loanId - Loan ID
   * @returns {Promise<boolean>} True if loan has matured
   */
  async checkLoanMaturity(loanId) {
    const loan = await this.getLoan(loanId);
    if (!loan || loan.StatusID !== STATUS.APPROVED) {
      return false;
    }

    const hasMatured = financialService.hasReachedMaturity(
      loan.StartDate,
      loan.Term
    );

    if (hasMatured) {
      // Check if loan is paid off
      const isPaidOff = await this.checkLoanPayoff(loanId);

      if (!isPaidOff) {
        // Loan has matured but not paid off - could add notifications here
        // For now, just return true to indicate maturity
        return true;
      }
    }

    return hasMatured;
  },

  /**
   * Get loans maturing within specified days
   * @param {number} days - Number of days to look ahead (default: 30)
   * @returns {Promise<Array>} Array of loans maturing soon
   */
  async getMaturingLoans(days = 30) {
    const loans = await db.queryMany(
      `SELECT a.*, u.Name, u.Surname, u.UserID
       FROM Accounts a
       INNER JOIN Users u ON a.UserID = u.UserID
       WHERE a.AccountTypeID = ? AND a.StatusID = ?`,
      [ACCOUNT_TYPES.LOAN, STATUS.APPROVED]
    );
    const maturingLoans = [];

    for (const loan of loans) {
      const maturityDate = financialService.calculateMaturityDate(loan.StartDate, loan.Term);
      const daysUntilMaturity = Math.ceil((new Date(maturityDate) - new Date()) / (1000 * 60 * 60 * 24));

      if (daysUntilMaturity >= 0 && daysUntilMaturity <= days) {
        maturingLoans.push({
          ...loan,
          maturityDate,
          daysUntilMaturity
        });
      }
    }

    return maturingLoans;
  }
};

module.exports = loanService;
