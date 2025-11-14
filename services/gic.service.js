/**
 * GIC (Guaranteed Investment Certificate) service
 * Handles GIC product and investment operations
 */

const db = require('./database.service');
const accountService = require('./account.service');
const transactionService = require('./transaction.service');
const financialService = require('./financial.service');
const maturityLogger = require('./maturity-logger.service');
const { ACCOUNT_TYPES, STATUS, TRANSACTION_TYPES } = require('./constants');
const { formatDate } = require('../utils/formatters');

const gicService = {
  /**
   * Get all GIC products
   * @returns {Promise<Array>} Array of GIC products
   */
  async getAllGICProducts() {
    return await db.queryMany(
      'SELECT * FROM GICProducts ORDER BY ProductID DESC'
    );
  },

  /**
   * Get GIC product by ID
   * @param {number} productId - Product ID
   * @returns {Promise<object|null>} GIC product
   */
  async getGICProduct(productId) {
    return await db.queryOne(
      'SELECT * FROM GICProducts WHERE ProductID = ?',
      [productId]
    );
  },

  /**
   * Create a new GIC product
   * @param {object} productData - Product data
   * @returns {Promise<number>} New product ID
   */
  async createGICProduct(productData) {
    const {
      productName,
      interestRate,
      term,
      minimumAmount = 100
    } = productData;

    const result = await db.run(
      `INSERT INTO GICProducts (ProductName, InterestRate, Term, MinimumAmount)
       VALUES (?, ?, ?, ?)`,
      [productName, interestRate, term, minimumAmount]
    );

    return result.lastID;
  },

  /**
   * Update a GIC product
   * @param {number} productId - Product ID
   * @param {object} productData - Product data to update
   * @returns {Promise<void>}
   */
  async updateGICProduct(productId, productData) {
    const { productName, interestRate, term, minimumAmount } = productData;

    await db.run(
      `UPDATE GICProducts
       SET ProductName = ?, InterestRate = ?, Term = ?, MinimumAmount = ?
       WHERE ProductID = ?`,
      [productName, interestRate, term, minimumAmount, productId]
    );
  },

  /**
   * Delete a GIC product
   * @param {number} productId - Product ID
   * @returns {Promise<void>}
   */
  async deleteGICProduct(productId) {
    await db.run('DELETE FROM GICProducts WHERE ProductID = ?', [productId]);
  },

  /**
   * Get all GIC investments for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of GIC investments
   */
  async getUserGICs(userId) {
    return await db.queryMany(
      `SELECT a.*, gp.ProductName
       FROM Accounts a
       LEFT JOIN GICProducts gp ON a.Description = CAST(gp.ProductID AS TEXT)
       WHERE a.UserID = ? AND a.AccountTypeID = ?
       ORDER BY a.StartDate DESC`,
      [userId, ACCOUNT_TYPES.INVESTMENT]
    );
  },

  /**
   * Get GIC investment by ID
   * @param {number} gicId - GIC ID (Account ID)
   * @returns {Promise<object|null>} GIC investment
   */
  async getGIC(gicId) {
    return await db.queryOne(
      `SELECT a.*, gp.ProductName
       FROM Accounts a
       LEFT JOIN GICProducts gp ON a.Description = CAST(gp.ProductID AS TEXT)
       WHERE a.AccountID = ? AND a.AccountTypeID = ?`,
      [gicId, ACCOUNT_TYPES.INVESTMENT]
    );
  },

  /**
   * Get all active GIC investments
   * Used by daily tasks for interest calculations
   * @returns {Promise<Array>} Array of active GICs
   */
  async getActiveGICs() {
    return await db.queryMany(
      `SELECT * FROM Accounts
       WHERE AccountTypeID = ? AND StatusID = ?`,
      [ACCOUNT_TYPES.INVESTMENT, STATUS.ACTIVE]
    );
  },

  /**
   * Purchase a GIC investment
   * @param {object} purchaseData - Purchase data
   * @returns {Promise<number>} New GIC account ID
   */
  async purchaseGIC(purchaseData) {
    const {
      userId,
      chequingAccountId,
      productId,
      amount
    } = purchaseData;

    // Get product details
    const product = await this.getGICProduct(productId);
    if (!product) {
      throw new Error('GIC product not found');
    }

    // Validate minimum investment
    if (amount < product.MinimumAmount) {
      const error = new Error(`Minimum investment amount is $${product.MinimumAmount.toFixed(2)}`);
      error.status = 400;
      throw error;
    }

    // Check available balance
    const availableBalance = await accountService.getApprovedBalance(chequingAccountId);
    if (availableBalance < amount) {
      const error = new Error('Insufficient funds for this investment');
      error.status = 400;
      throw error;
    }

    // Create GIC investment account and withdrawal transaction atomically
    const gicAccountId = await db.transaction(async () => {
      // Create GIC investment account
      const gicAccountId = await accountService.createAccount({
        userId,
        accountTypeId: ACCOUNT_TYPES.INVESTMENT,
        interestRate: product.InterestRate,
        principalAmount: amount,
        term: product.Term,
        startDate: formatDate(new Date()),
        statusId: STATUS.ACTIVE,
        balance: amount,
        description: productId.toString()
      });

      // Create withdrawal from chequing account
      await transactionService.createTransaction({
        accountId: chequingAccountId,
        transactionTypeId: TRANSACTION_TYPES.WITHDRAWAL,
        amount,
        date: formatDate(new Date()),
        description: `GIC Investment - ${product.ProductName}`,
        statusId: STATUS.APPROVED
      });

      return gicAccountId;
    });

    // Get user details for logging
    const user = await db.queryOne(
      'SELECT Name, Surname FROM Users WHERE UserID = ?',
      [userId]
    );

    // Log GIC purchase event
    maturityLogger.logGICPurchase({
      gicId: gicAccountId,
      userId,
      userName: `${user.Name} ${user.Surname}`,
      productName: product.ProductName,
      principal: amount,
      rate: product.InterestRate,
      term: product.Term,
      startDate: formatDate(new Date()),
      chequingAccountId
    });

    return gicAccountId;
  },

  /**
   * Calculate maturity value for a GIC
   * @param {object} gic - GIC object
   * @returns {number} Maturity value
   */
  calculateGICMaturityValue(gic) {
    return financialService.calculateGICMaturityValue(
      gic.PrincipalAmount,
      gic.InterestRate,
      gic.Term
    );
  },

  /**
   * Check if GIC has reached maturity
   * @param {number} gicId - GIC ID
   * @returns {Promise<boolean>} True if matured
   */
  async checkGICMaturity(gicId) {
    const gic = await this.getGIC(gicId);
    if (!gic || gic.StatusID !== STATUS.ACTIVE) {
      return false;
    }

    return financialService.hasReachedMaturity(gic.StartDate, gic.Term);
  },

  /**
   * Mature a GIC (transfer funds back to chequing with interest)
   * @param {number} gicId - GIC ID
   * @returns {Promise<boolean>} True if successfully matured
   */
  async matureGIC(gicId) {
    const gic = await this.getGIC(gicId);
    if (!gic || gic.StatusID !== STATUS.ACTIVE) {
      return false;
    }

    // Check if GIC has reached maturity date
    const hasMatured = await this.checkGICMaturity(gicId);
    if (!hasMatured) {
      return false;
    }

    // Calculate maturity value with compound interest
    const maturityValue = Math.round(this.calculateGICMaturityValue(gic) * 100) / 100;
    const interestEarned = maturityValue - gic.PrincipalAmount;

    // Get user's chequing account
    const chequingAccount = await db.queryOne(
      `SELECT AccountID FROM Accounts
       WHERE UserID = ? AND AccountTypeID = ?`,
      [gic.UserID, ACCOUNT_TYPES.CHEQUING]
    );

    if (!chequingAccount) {
      throw new Error('User chequing account not found');
    }

    // Log maturity event
    maturityLogger.logGICMaturity({
      gicId,
      userId: gic.UserID,
      productName: gic.ProductName || 'Investment',
      principal: gic.PrincipalAmount,
      term: gic.Term,
      startDate: gic.StartDate
    });

    // Perform all operations atomically
    await db.transaction(async () => {
      // Deposit maturity value to chequing account
      await transactionService.createSystemTransaction({
        accountId: chequingAccount.AccountID,
        transactionTypeId: TRANSACTION_TYPES.DEPOSIT,
        amount: maturityValue,
        description: `GIC maturity - ${gic.ProductName || 'Investment'} (Principal: $${gic.PrincipalAmount.toFixed(2)}, Maturity: $${maturityValue.toFixed(2)})`
      });

      // Update GIC status to CLOSED
      await accountService.updateAccountStatus(gicId, STATUS.CLOSED);
    });

    // Log payoff event
    maturityLogger.logGICPayoff({
      gicId,
      userId: gic.UserID,
      maturityValue,
      interestEarned,
      chequingAccountId: chequingAccount.AccountID
    });

    return true;
  },

  /**
   * Get GICs maturing within specified days
   * @param {number} days - Number of days to look ahead (default: 30)
   * @returns {Promise<Array>} Array of GICs maturing soon
   */
  async getMaturingGICs(days = 30) {
    const gics = await db.queryMany(
      `SELECT a.*, u.Name, u.Surname, u.UserID
       FROM Accounts a
       INNER JOIN Users u ON a.UserID = u.UserID
       WHERE a.AccountTypeID = ? AND a.StatusID = ?`,
      [ACCOUNT_TYPES.INVESTMENT, STATUS.ACTIVE]
    );
    const maturingGICs = [];

    for (const gic of gics) {
      const maturityDate = financialService.calculateMaturityDate(gic.StartDate, gic.Term);
      const daysUntilMaturity = Math.ceil((new Date(maturityDate) - new Date()) / (1000 * 60 * 60 * 24));

      if (daysUntilMaturity >= 0 && daysUntilMaturity <= days) {
        maturingGICs.push({
          ...gic,
          maturityDate,
          daysUntilMaturity
        });
      }
    }

    return maturingGICs;
  }
};

module.exports = gicService;
