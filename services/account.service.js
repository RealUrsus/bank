/**
 * Account service
 * Handles account operations and balance calculations
 */

const db = require('./database.service');
const { ACCOUNT_TYPES, ACCOUNT_TYPE_NAMES, STATUS } = require('./constants');

const accountService = {
  /**
   * Get account by ID
   * @param {number} accountId - Account ID
   * @returns {Promise<object|null>} Account record
   */
  async getAccount(accountId) {
    return await db.queryOne(
      'SELECT * FROM Accounts WHERE AccountID = ?',
      [accountId]
    );
  },

  /**
   * Get or create a chequing account for a user
   * @param {number} userId - User ID
   * @param {string} accountTypeName - Account type name (default: 'Chequing')
   * @returns {Promise<number>} Account ID
   */
  async getOrCreateAccount(userId, accountTypeName = 'Chequing') {
    // Check if account exists
    const existingAccount = await db.queryOne(
      `SELECT a.AccountID
       FROM Accounts a
       INNER JOIN AccountTypes at ON a.AccountTypeID = at.AccountTypeID
       WHERE a.UserID = ? AND at.AccountTypeName = ?`,
      [userId, accountTypeName]
    );

    if (existingAccount) {
      return existingAccount.AccountID;
    }

    // Create new account
    const result = await db.run(
      `INSERT INTO Accounts (UserID, AccountTypeID, StatusID)
       VALUES (?, ?, ?)`,
      [userId, ACCOUNT_TYPES.CHEQUING, STATUS.ACTIVE]
    );

    return result.lastID;
  },

  /**
   * Calculate total balance (including pending transactions)
   * @param {number} accountId - Account ID
   * @returns {Promise<number>} Total balance
   */
  async getBalance(accountId) {
    const result = await db.queryOne(
      `SELECT SUM(Amount * CASE WHEN TransactionTypeID = 1 THEN 1 ELSE -1 END) AS total
       FROM Transactions
       WHERE AccountID = ?`,
      [accountId]
    );
    return result?.total || 0;
  },

  /**
   * Calculate approved balance only (excludes pending transactions)
   * @param {number} accountId - Account ID
   * @returns {Promise<number>} Approved balance
   */
  async getApprovedBalance(accountId) {
    const result = await db.queryOne(
      `SELECT SUM(Amount * CASE WHEN TransactionTypeID = 1 THEN 1 ELSE -1 END) AS total
       FROM Transactions
       JOIN Status ON Transactions.StatusID = Status.StatusID
       WHERE AccountID = ?
         AND (Status.StatusName = 'Active' OR Status.StatusName = 'Paid Off')`,
      [accountId]
    );
    return result?.total || 0;
  },

  /**
   * Update account status
   * @param {number} accountId - Account ID
   * @param {number} statusId - New status ID
   * @returns {Promise<void>}
   */
  async updateAccountStatus(accountId, statusId) {
    await db.run(
      'UPDATE Accounts SET StatusID = ? WHERE AccountID = ?',
      [statusId, accountId]
    );
  },

  /**
   * Get account type name by ID
   * @param {number} accountTypeId - Account type ID
   * @returns {string} Account type name
   */
  getAccountTypeName(accountTypeId) {
    return ACCOUNT_TYPE_NAMES[accountTypeId] || 'Account';
  },

  /**
   * Get all accounts for a user
   * @param {number} userId - User ID
   * @param {number} accountTypeId - Optional account type filter
   * @returns {Promise<Array>} Array of accounts
   */
  async getUserAccounts(userId, accountTypeId = null) {
    if (accountTypeId) {
      return await db.queryMany(
        `SELECT a.*, at.AccountTypeName, s.StatusName
         FROM Accounts a
         INNER JOIN AccountTypes at ON a.AccountTypeID = at.AccountTypeID
         INNER JOIN Status s ON a.StatusID = s.StatusID
         WHERE a.UserID = ? AND a.AccountTypeID = ?
         ORDER BY a.AccountID DESC`,
        [userId, accountTypeId]
      );
    }

    return await db.queryMany(
      `SELECT a.*, at.AccountTypeName, s.StatusName
       FROM Accounts a
       INNER JOIN AccountTypes at ON a.AccountTypeID = at.AccountTypeID
       INNER JOIN Status s ON a.StatusID = s.StatusID
       WHERE a.UserID = ?
       ORDER BY a.AccountID DESC`,
      [userId]
    );
  },

  /**
   * Create a new account
   * @param {object} accountData - Account data
   * @returns {Promise<number>} New account ID
   */
  async createAccount(accountData) {
    const {
      userId,
      accountTypeId,
      interestRate = null,
      principalAmount = null,
      term = null,
      startDate = null,
      statusId,
      description = null,
      paymentFrequency = null,
      balance = null,
      minimumBalance = null
    } = accountData;

    // Build dynamic INSERT to only include fields that are provided
    const fields = ['UserID', 'AccountTypeID', 'StatusID'];
    const values = [userId, accountTypeId, statusId];

    if (interestRate !== null) {
      fields.push('InterestRate');
      values.push(interestRate);
    }
    if (principalAmount !== null) {
      fields.push('PrincipalAmount');
      values.push(principalAmount);
    }
    if (term !== null) {
      fields.push('Term');
      values.push(term);
    }
    if (startDate !== null) {
      fields.push('StartDate');
      values.push(startDate);
    }
    if (description !== null) {
      fields.push('Description');
      values.push(description);
    }
    if (paymentFrequency !== null) {
      fields.push('PaymentFrequency');
      values.push(paymentFrequency);
    }
    if (balance !== null) {
      fields.push('Balance');
      values.push(balance);
    }
    if (minimumBalance !== null) {
      fields.push('MinimumBalance');
      values.push(minimumBalance);
    }

    const placeholders = values.map(() => '?').join(', ');
    const sql = `INSERT INTO Accounts (${fields.join(', ')}) VALUES (${placeholders})`;

    const result = await db.run(sql, values);
    return result.lastID;
  },

  /**
   * Update an account
   * @param {number} accountId - Account ID
   * @param {object} accountData - Account data to update
   * @returns {Promise<void>}
   */
  async updateAccount(accountId, accountData) {
    const {
      userId,
      interestRate,
      principalAmount,
      term,
      startDate,
      description,
      statusId
    } = accountData;

    await db.run(
      `UPDATE Accounts
       SET UserID = ?, InterestRate = ?, PrincipalAmount = ?,
           Term = ?, StartDate = ?, Description = ?, StatusID = ?
       WHERE AccountID = ?`,
      [userId, interestRate, principalAmount, term, startDate, description, statusId, accountId]
    );
  },

  /**
   * Delete an account
   * @param {number} accountId - Account ID
   * @returns {Promise<void>}
   */
  async deleteAccount(accountId) {
    await db.run('DELETE FROM Accounts WHERE AccountID = ?', [accountId]);
  }
};

module.exports = accountService;
