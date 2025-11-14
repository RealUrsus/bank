/**
 * Loan service
 * Handles loan-specific business logic
 */

const db = require('./database.service');
const accountService = require('./account.service');
const transactionService = require('./transaction.service');
const financialService = require('./financial.service');
const maturityLogger = require('./maturity-logger.service');
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
   * @param {boolean} activeOnly - Only return active loans (excludes paid off)
   * @returns {Promise<Array>} Array of loans
   */
  async getUserLoans(userId, activeOnly = false) {
    if (activeOnly) {
      return await db.queryMany(
        `SELECT a.*, s.StatusName
         FROM Accounts a
         INNER JOIN Status s ON a.StatusID = s.StatusID
         WHERE a.UserID = ? AND a.AccountTypeID = ?
           AND s.StatusName = 'Active'
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
   * Get all active loans
   * Used by daily tasks for interest calculations
   * @returns {Promise<Array>} Array of active loans
   */
  async getActiveLoans() {
    return await db.queryMany(
      `SELECT * FROM Accounts
       WHERE AccountTypeID = ? AND StatusID = ?`,
      [ACCOUNT_TYPES.LOAN, STATUS.ACTIVE]
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

    // Server-side validation: Reject past dates (today is allowed)
    // Use string comparison to avoid timezone issues
    const today = new Date();
    const todayString = today.getFullYear() + '-' +
                       String(today.getMonth() + 1).padStart(2, '0') + '-' +
                       String(today.getDate()).padStart(2, '0');

    if (startDate < todayString) {
      const error = new Error('Loan start date cannot be in the past');
      error.status = 400;
      throw error;
    }

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
   * Funds will be disbursed on the start date during daily tasks
   * @param {number} loanId - Loan ID
   * @returns {Promise<void>}
   */
  async approveLoan(loanId) {
    const loan = await this.getLoan(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }

    await accountService.updateAccountStatus(loanId, STATUS.ACTIVE);

    // Log approval event
    maturityLogger.logLoanApproval({
      loanId,
      userId: loan.UserID,
      userName: `${loan.Name} ${loan.Surname}`,
      principal: loan.PrincipalAmount,
      rate: loan.InterestRate,
      term: loan.Term,
      startDate: loan.StartDate,
      frequency: loan.PaymentFrequency
    });
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
    if (!loan || loan.StatusID !== STATUS.ACTIVE) {
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
   * Disburse loan funds to chequing account on start date
   * Called by daily tasks to check if loan should be disbursed today
   * @param {number} loanId - Loan ID
   * @returns {Promise<boolean>} True if loan was disbursed
   */
  async disburseLoan(loanId) {
    const loan = await this.getLoan(loanId);
    if (!loan || loan.StatusID !== STATUS.ACTIVE) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(loan.StartDate);
    startDate.setHours(0, 0, 0, 0);

    // Check if today is the start date or later, and loan hasn't been disbursed yet
    if (today < startDate) {
      return false; // Start date hasn't arrived yet
    }

    // Get user's chequing account first
    const chequingAccount = await db.queryOne(
      `SELECT AccountID FROM Accounts
       WHERE UserID = ? AND AccountTypeID = ?`,
      [loan.UserID, ACCOUNT_TYPES.CHEQUING]
    );

    if (!chequingAccount) {
      throw new Error('User chequing account not found');
    }

    // Check if loan has already been disbursed by looking for existing disbursement transaction
    const existingDisbursement = await db.queryOne(
      `SELECT TransactionID FROM Transactions
       WHERE AccountID = ?
       AND Description LIKE ?
       LIMIT 1`,
      [chequingAccount.AccountID, `Loan disbursement - Loan #${loanId}%`]
    );

    if (existingDisbursement) {
      return false; // Already disbursed
    }

    // Deposit loan principal to chequing account
    await transactionService.createSystemTransaction({
      accountId: chequingAccount.AccountID,
      transactionTypeId: TRANSACTION_TYPES.DEPOSIT,
      amount: loan.PrincipalAmount,
      description: `Loan disbursement - Loan #${loanId} ($${loan.PrincipalAmount.toFixed(2)} at ${loan.InterestRate}% APR)`
    });

    // Log disbursement event
    maturityLogger.logLoanDisbursement({
      loanId,
      userId: loan.UserID,
      userName: `${loan.Name} ${loan.Surname}`,
      principal: loan.PrincipalAmount,
      chequingAccountId: chequingAccount.AccountID
    });

    return true;
  },

  /**
   * Process loan interest based on payment frequency
   * Charges interest monthly or annually from chequing account
   * @param {number} loanId - Loan ID
   * @returns {Promise<number|null>} Transaction ID or null if not applicable
   */
  async processLoanInterest(loanId) {
    const loan = await this.getLoan(loanId);
    if (!loan || loan.StatusID !== STATUS.ACTIVE) {
      return null;
    }

    const now = new Date();
    const startDate = new Date(loan.StartDate);

    // Calculate months elapsed since loan start
    const monthsElapsed = (now.getFullYear() - startDate.getFullYear()) * 12 +
                          (now.getMonth() - startDate.getMonth());

    // Check if today is the anniversary day of the month
    const isAnniversaryDay = now.getDate() === startDate.getDate();

    let isDue = false;
    let interestAmount = 0;
    let periodDescription = '';

    if (loan.PaymentFrequency === 'Monthly') {
      // Monthly payment: Due on the same day each month after the start date
      // Example: Loan starts on Jan 15 -> payments on Feb 15, Mar 15, etc.
      if (monthsElapsed > 0 && isAnniversaryDay) {
        isDue = true;
        interestAmount = Math.round((loan.PrincipalAmount * loan.InterestRate / 100) / 12 * 100) / 100;
        periodDescription = 'Monthly';
      }
    } else if (loan.PaymentFrequency === 'Annual') {
      // Annual payment: Due on the same date each year after the start date
      // Example: Loan starts on Jan 15, 2024 -> payment on Jan 15, 2025
      if (monthsElapsed > 0 && monthsElapsed % 12 === 0 && isAnniversaryDay) {
        isDue = true;
        interestAmount = Math.round(loan.PrincipalAmount * loan.InterestRate / 100 * 100) / 100;
        periodDescription = 'Annual';
      }
    }

    if (!isDue || interestAmount <= 0) {
      return null;
    }

    // Get user's chequing account
    const chequingAccount = await db.queryOne(
      `SELECT AccountID FROM Accounts
       WHERE UserID = ? AND AccountTypeID = ?`,
      [loan.UserID, ACCOUNT_TYPES.CHEQUING]
    );

    if (!chequingAccount) {
      throw new Error('User chequing account not found');
    }

    // Withdraw interest from chequing account
    const transactionId = await transactionService.createSystemTransaction({
      accountId: chequingAccount.AccountID,
      transactionTypeId: TRANSACTION_TYPES.WITHDRAWAL,
      amount: interestAmount,
      description: `${periodDescription} loan interest payment - Loan #${loanId} (${loan.InterestRate}% APR)`
    });

    return transactionId;
  },

  /**
   * Check loan maturity and process accordingly
   * Logs matured loans, withdraws remaining balance, and closes the loan
   * @param {number} loanId - Loan ID
   * @returns {Promise<boolean>} True if loan has matured and was processed
   */
  async checkLoanMaturity(loanId) {
    const loan = await this.getLoan(loanId);
    if (!loan || loan.StatusID !== STATUS.ACTIVE) {
      return false;
    }

    // Check if loan has reached maturity date
    const hasMatured = financialService.hasReachedMaturity(
      loan.StartDate,
      loan.Term
    );

    if (!hasMatured) {
      return false;
    }

    // Calculate remaining balance owed on the loan
    const currentBalance = await accountService.getBalance(loanId);
    const remainingBalance = Math.round((loan.PrincipalAmount - currentBalance) * 100) / 100;

    // Log maturity event
    maturityLogger.logLoanMaturity({
      loanId,
      userId: loan.UserID,
      userName: `${loan.Name} ${loan.Surname}`,
      principal: loan.PrincipalAmount,
      balancePaid: currentBalance,
      remaining: remainingBalance
    });

    // Get user's chequing account
    const chequingAccount = await db.queryOne(
      `SELECT AccountID FROM Accounts
       WHERE UserID = ? AND AccountTypeID = ?`,
      [loan.UserID, ACCOUNT_TYPES.CHEQUING]
    );

    if (!chequingAccount) {
      throw new Error('User chequing account not found');
    }

    // Perform final withdrawal and status update atomically
    await db.transaction(async () => {
      // Withdraw remaining loan balance from chequing account if any balance remains
      if (remainingBalance > 0) {
        await transactionService.createSystemTransaction({
          accountId: chequingAccount.AccountID,
          transactionTypeId: TRANSACTION_TYPES.WITHDRAWAL,
          amount: remainingBalance,
          description: `Loan maturity - Final payment for Loan #${loanId} (Remaining: $${remainingBalance.toFixed(2)})`
        });
      }

      // Update loan status to CLOSED (consistent with GIC maturity handling)
      await accountService.updateAccountStatus(loanId, STATUS.CLOSED);
    });

    // Log closure event
    maturityLogger.logLoanClosure({
      loanId,
      userId: loan.UserID,
      finalPayment: remainingBalance
    });

    return true;
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
      [ACCOUNT_TYPES.LOAN, STATUS.ACTIVE]
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
