/**
 * Transaction service
 * Handles transaction operations and transfer logic
 */

const db = require('./database.service');
const { TRANSACTION_TYPES, STATUS } = require('./constants');
const { formatDate } = require('../utils/formatters');

const transactionService = {
  /**
   * Create a new transaction (user-initiated)
   * @param {object} transactionData - Transaction data
   * @returns {Promise<number>} New transaction ID
   */
  async createTransaction(transactionData) {
    const {
      accountId,
      transactionTypeId,
      amount,
      date,
      description,
      transferId = null,
      statusId = STATUS.PENDING
    } = transactionData;

    const result = await db.run(
      `INSERT INTO Transactions (
        AccountID, TransactionTypeID, Amount, Date,
        Description, TransferID, StatusID
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [accountId, transactionTypeId, amount, date, description, transferId, statusId]
    );

    return result.lastID;
  },

  /**
   * Create a system-generated transaction (e.g., interest accrual)
   * These are automatically approved
   * @param {object} transactionData - Transaction data
   * @returns {Promise<number>} New transaction ID
   */
  async createSystemTransaction(transactionData) {
    const {
      accountId,
      transactionTypeId,
      amount,
      description
    } = transactionData;

    return await this.createTransaction({
      accountId,
      transactionTypeId,
      amount,
      date: formatDate(new Date()),
      description: `[SYSTEM] ${description}`,
      statusId: STATUS.APPROVED
    });
  },

  /**
   * Get transactions for an account
   * @param {number} accountId - Account ID
   * @param {number} limit - Optional limit
   * @returns {Promise<Array>} Array of transactions
   */
  async getTransactions(accountId, limit = null) {
    const sql = limit
      ? 'SELECT * FROM Transactions WHERE AccountID = ? ORDER BY Date DESC, TransactionID DESC LIMIT ?'
      : 'SELECT * FROM Transactions WHERE AccountID = ? ORDER BY Date DESC, TransactionID DESC';

    const params = limit ? [accountId, limit] : [accountId];
    return await db.queryMany(sql, params);
  },

  /**
   * Get transactions by date range
   * @param {number} accountId - Account ID
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of transactions
   */
  async getTransactionsByDateRange(accountId, startDate, endDate) {
    return await db.queryMany(
      `SELECT * FROM Transactions
       WHERE AccountID = ? AND Date >= ? AND Date <= ?
       ORDER BY Date ASC`,
      [accountId, startDate, endDate]
    );
  },

  /**
   * Get transactions by period (last N days)
   * @param {number} accountId - Account ID
   * @param {number} days - Number of days
   * @returns {Promise<Array>} Array of transactions
   */
  async getTransactionsByPeriod(accountId, days) {
    const endDate = formatDate(new Date());
    const startDate = formatDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

    return await this.getTransactionsByDateRange(accountId, startDate, endDate);
  },

  /**
   * Get pending transactions for a user's chequing account
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of pending transactions
   */
  async getPendingTransactionsByUser(userId) {
    return await db.queryMany(
      `SELECT t.*
       FROM Transactions t
       INNER JOIN Accounts a ON t.AccountID = a.AccountID
       WHERE a.UserID = ? AND a.AccountTypeID = 1 AND t.StatusID = 1`,
      [userId]
    );
  },

  /**
   * Approve a transaction
   * @param {number} transactionId - Transaction ID
   * @returns {Promise<void>}
   */
  async approveTransaction(transactionId) {
    await db.run(
      'UPDATE Transactions SET StatusID = ? WHERE TransactionID = ?',
      [STATUS.APPROVED, transactionId]
    );
  },

  /**
   * Delete a transaction
   * @param {number} transactionId - Transaction ID
   * @returns {Promise<void>}
   */
  async deleteTransaction(transactionId) {
    await db.run('DELETE FROM Transactions WHERE TransactionID = ?', [transactionId]);
  },

  /**
   * Execute an internal transfer between accounts
   * @param {object} transferData - Transfer data
   * @returns {Promise<string>} Transfer ID
   */
  async executeTransfer(transferData) {
    const {
      sourceAccountId,
      destinationAccountId,
      amount,
      sourceDescription,
      destinationDescription
    } = transferData;

    // Generate unique transfer ID
    const transferId = Math.floor(Math.random() * 10 ** 12).toString();
    const date = formatDate(new Date());

    // Create both transactions in a transaction block for atomicity
    await db.transaction(async () => {
      // Credit to destination
      await this.createTransaction({
        accountId: destinationAccountId,
        transactionTypeId: TRANSACTION_TYPES.DEPOSIT,
        amount,
        date,
        description: destinationDescription,
        transferId,
        statusId: STATUS.APPROVED
      });

      // Debit from source
      await this.createTransaction({
        accountId: sourceAccountId,
        transactionTypeId: TRANSACTION_TYPES.WITHDRAWAL,
        amount,
        date,
        description: sourceDescription,
        transferId,
        statusId: STATUS.APPROVED
      });
    });

    return transferId;
  },

  /**
   * Get transactions by transfer ID
   * @param {string} transferId - Transfer ID
   * @returns {Promise<Array>} Array of transactions (should be 2)
   */
  async getTransactionsByTransferId(transferId) {
    return await db.queryMany(
      'SELECT * FROM Transactions WHERE TransferID = ?',
      [transferId]
    );
  }
};

module.exports = transactionService;
