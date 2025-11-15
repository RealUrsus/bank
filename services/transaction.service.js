/**
 * Transaction service
 * Handles transaction operations and transfer logic
 */

const crypto = require('crypto');
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
      category = null,
      transferId = null,
      statusId = STATUS.PENDING
    } = transactionData;

    const result = await db.run(
      `INSERT INTO Transactions (
        AccountID, TransactionTypeID, Amount, Date,
        Description, Category, TransferID, StatusID
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [accountId, transactionTypeId, amount, date, description, category, transferId, statusId]
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
    const { ACCOUNT_TYPES } = require('./constants');
    return await db.queryMany(
      `SELECT t.*
       FROM Transactions t
       INNER JOIN Accounts a ON t.AccountID = a.AccountID
       WHERE a.UserID = ? AND a.AccountTypeID = ? AND t.StatusID = ?`,
      [userId, ACCOUNT_TYPES.CHEQUING, STATUS.PENDING]
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

    // Generate unique transfer ID using cryptographically secure random bytes
    const transferId = crypto.randomBytes(8).toString('hex');
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
  },

  /**
   * Get count of all pending transactions
   * @returns {Promise<number>} Count of pending transactions
   */
  async getPendingTransactionsCount() {
    const { ACCOUNT_TYPES } = require('./constants');
    const result = await db.queryOne(
      `SELECT COUNT(*) AS count
       FROM Transactions t
       INNER JOIN Accounts a ON t.AccountID = a.AccountID
       WHERE t.StatusID = ? AND a.AccountTypeID = ?`,
      [STATUS.PENDING, ACCOUNT_TYPES.CHEQUING]
    );
    return result?.count || 0;
  },

  /**
   * Get all pending transactions with client information
   * @returns {Promise<Array>} Array of pending transactions with client info
   */
  async getAllPendingTransactions() {
    const { ACCOUNT_TYPES } = require('./constants');
    return await db.queryMany(
      `SELECT t.*, u.UserID, u.Name, u.Surname
       FROM Transactions t
       INNER JOIN Accounts a ON t.AccountID = a.AccountID
       INNER JOIN Users u ON a.UserID = u.UserID
       WHERE t.StatusID = ? AND a.AccountTypeID = ?
       ORDER BY t.CreatedAt DESC`,
      [STATUS.PENDING, ACCOUNT_TYPES.CHEQUING]
    );
  },

  /**
   * Generate report data based on filters
   * @param {number} accountId - Account ID
   * @param {object} filters - Report filters
   * @param {string} filters.category - Category filter (optional)
   * @param {string} filters.transactionType - Transaction type filter: 'income' or 'expense' (optional)
   * @param {string} filters.startDate - Start date (YYYY-MM-DD) (optional)
   * @param {string} filters.endDate - End date (YYYY-MM-DD) (optional)
   * @returns {Promise<object>} Report data with aggregated statistics
   */
  async generateReport(accountId, filters = {}) {
    const { category, transactionType, startDate, endDate } = filters;

    // Build WHERE clause based on filters
    const whereConditions = ['AccountID = ?', 'StatusID = ?'];
    const params = [accountId, STATUS.APPROVED]; // Only approved transactions

    if (category) {
      whereConditions.push('Category = ?');
      params.push(category);
    }

    if (transactionType === 'income') {
      whereConditions.push('TransactionTypeID = ?');
      params.push(TRANSACTION_TYPES.DEPOSIT);
    } else if (transactionType === 'expense') {
      whereConditions.push('TransactionTypeID = ?');
      params.push(TRANSACTION_TYPES.WITHDRAWAL);
    }

    if (startDate && endDate) {
      whereConditions.push('Date >= ?');
      whereConditions.push('Date <= ?');
      params.push(startDate, endDate);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get all matching transactions
    const transactions = await db.queryMany(
      `SELECT * FROM Transactions WHERE ${whereClause} ORDER BY Date DESC`,
      params
    );

    // Calculate aggregated statistics
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryBreakdown = {};

    transactions.forEach(t => {
      if (t.TransactionTypeID === TRANSACTION_TYPES.DEPOSIT) {
        totalIncome += t.Amount;
      } else if (t.TransactionTypeID === TRANSACTION_TYPES.WITHDRAWAL) {
        totalExpense += t.Amount;
      }

      // Category breakdown
      if (t.Category) {
        if (!categoryBreakdown[t.Category]) {
          categoryBreakdown[t.Category] = {
            income: 0,
            expense: 0,
            count: 0
          };
        }
        categoryBreakdown[t.Category].count++;
        if (t.TransactionTypeID === TRANSACTION_TYPES.DEPOSIT) {
          categoryBreakdown[t.Category].income += t.Amount;
        } else if (t.TransactionTypeID === TRANSACTION_TYPES.WITHDRAWAL) {
          categoryBreakdown[t.Category].expense += t.Amount;
        }
      }
    });

    return {
      transactions,
      summary: {
        totalIncome,
        totalExpense,
        netAmount: totalIncome - totalExpense,
        transactionCount: transactions.length
      },
      categoryBreakdown
    };
  }
};

module.exports = transactionService;
