/**
 * GIC (Guaranteed Investment Certificate) service
 * Handles GIC product and investment operations
 */

const db = require('./database.service');
const accountService = require('./account.service');
const transactionService = require('./transaction.service');
const financialService = require('./financial.service');
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
      [ACCOUNT_TYPES.INVESTMENT, STATUS.APPROVED]
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
    return await db.transaction(async () => {
      // Create GIC investment account
      const gicAccountId = await accountService.createAccount({
        userId,
        accountTypeId: ACCOUNT_TYPES.INVESTMENT,
        interestRate: product.InterestRate,
        principalAmount: amount,
        term: product.Term,
        startDate: formatDate(new Date()),
        statusId: STATUS.APPROVED,
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
  },

  /**
   * Calculate accrued interest for a GIC
   * @param {object} gic - GIC object
   * @param {number} days - Number of days since last accrual
   * @returns {number} Interest amount
   */
  calculateGICInterest(gic, days = 1) {
    return financialService.calculateAccruedInterest(
      gic.PrincipalAmount,
      gic.InterestRate,
      days
    );
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
   * Process daily interest for a GIC
   * Creates a system transaction for interest
   * @param {number} gicId - GIC ID
   * @returns {Promise<number|null>} Transaction ID or null if not applicable
   */
  async processDailyInterest(gicId) {
    const gic = await this.getGIC(gicId);
    if (!gic || gic.StatusID !== STATUS.APPROVED) {
      return null;
    }

    const interest = this.calculateGICInterest(gic, 1);

    if (interest > 0) {
      const transactionId = await transactionService.createSystemTransaction({
        accountId: gicId,
        transactionTypeId: TRANSACTION_TYPES.DEPOSIT,
        amount: interest,
        description: `Daily interest accrual (${gic.InterestRate}% APR)`
      });

      return transactionId;
    }

    return null;
  },

  /**
   * Check if GIC has reached maturity
   * @param {number} gicId - GIC ID
   * @returns {Promise<boolean>} True if matured
   */
  async checkGICMaturity(gicId) {
    const gic = await this.getGIC(gicId);
    if (!gic || gic.StatusID !== STATUS.APPROVED) {
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
    if (!gic || gic.StatusID !== STATUS.APPROVED) {
      return false;
    }

    // Check if actually matured
    const hasMatured = await this.checkGICMaturity(gicId);
    if (!hasMatured) {
      return false;
    }

    // Calculate total value with interest
    const maturityValue = this.calculateGICMaturityValue(gic);
    const totalInterest = maturityValue - gic.PrincipalAmount;

    // Get user's chequing account
    const chequingAccount = await db.queryOne(
      `SELECT AccountID FROM Accounts
       WHERE UserID = ? AND AccountTypeID = ?`,
      [gic.UserID, ACCOUNT_TYPES.CHEQUING]
    );

    if (!chequingAccount) {
      throw new Error('User chequing account not found');
    }

    await db.transaction(async () => {
      // Add final interest if any
      if (totalInterest > 0) {
        await transactionService.createSystemTransaction({
          accountId: gicId,
          transactionTypeId: TRANSACTION_TYPES.DEPOSIT,
          amount: totalInterest,
          description: `GIC maturity interest (Total: $${maturityValue.toFixed(2)})`
        });
      }

      // Transfer maturity value back to chequing
      await transactionService.createSystemTransaction({
        accountId: chequingAccount.AccountID,
        transactionTypeId: TRANSACTION_TYPES.DEPOSIT,
        amount: maturityValue,
        description: `GIC maturity - ${gic.ProductName || 'Investment'}`
      });

      // Mark GIC as closed
      await accountService.updateAccountStatus(gicId, STATUS.CLOSED);
    });

    return true;
  }
};

module.exports = gicService;
