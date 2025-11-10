/**
 * Database service - Promisified SQLite3 wrapper
 * Eliminates repetitive Promise wrapping throughout the application
 */

const db = require('../utils/db');

const databaseService = {
  /**
   * Execute a query that returns a single row
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<object|null>} Single row or null
   */
  queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  },

  /**
   * Execute a query that returns multiple rows
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} Array of rows
   */
  queryMany(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  },

  /**
   * Execute an INSERT, UPDATE, or DELETE statement
   * @param {string} sql - SQL statement
   * @param {Array} params - Statement parameters
   * @returns {Promise<object>} Object with lastID and changes
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({
          lastID: this.lastID,
          changes: this.changes
        });
      });
    });
  },

  /**
   * Execute multiple statements in a transaction
   * @param {Function} callback - Async function that performs DB operations
   * @returns {Promise<any>} Result of the callback
   */
  async transaction(callback) {
    try {
      await this.run('BEGIN TRANSACTION');
      const result = await callback();
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }
};

module.exports = databaseService;
