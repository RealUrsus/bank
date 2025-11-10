/**
 * Agreement service
 * Handles agreement/contract operations
 */

const db = require('./database.service');
const { STATUS } = require('./constants');

const agreementService = {
  /**
   * Get all agreements
   * @returns {Promise<Array>} Array of agreements
   */
  async getAllAgreements() {
    return await db.queryMany(
      `SELECT u.Name, u.Surname, a.AgreementID, a.AgreementName, s.StatusName
       FROM Users u
       INNER JOIN Agreements a ON u.UserID = a.UserID
       INNER JOIN Status s ON a.StatusID = s.StatusID`
    );
  },

  /**
   * Get agreement by ID
   * @param {number} agreementId - Agreement ID
   * @returns {Promise<object|null>} Agreement record
   */
  async getAgreement(agreementId) {
    return await db.queryOne(
      `SELECT u.UserID, u.Name, u.Surname, a.AgreementID, a.AgreementName, a.AgreementContent, s.StatusName
       FROM Users u
       INNER JOIN Agreements a ON u.UserID = a.UserID
       INNER JOIN Status s ON a.StatusID = s.StatusID
       WHERE a.AgreementID = ?`,
      [agreementId]
    );
  },

  /**
   * Get agreements for a specific user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of agreements
   */
  async getUserAgreements(userId) {
    return await db.queryMany(
      `SELECT a.AgreementID, a.AgreementName, a.AgreementContent, s.StatusName
       FROM Agreements a
       INNER JOIN Status s ON a.StatusID = s.StatusID
       WHERE a.UserID = ?`,
      [userId]
    );
  },

  /**
   * Create a new agreement
   * @param {object} agreementData - Agreement data
   * @returns {Promise<number>} New agreement ID
   */
  async createAgreement(agreementData) {
    const {
      userId,
      agreementName,
      agreementContent,
      statusId = STATUS.ACTIVE
    } = agreementData;

    const result = await db.run(
      'INSERT INTO Agreements (UserID, AgreementName, AgreementContent, StatusID) VALUES (?, ?, ?, ?)',
      [userId, agreementName, agreementContent, statusId]
    );

    return result.lastID;
  },

  /**
   * Update an agreement
   * @param {number} agreementId - Agreement ID
   * @param {object} agreementData - Agreement data to update
   * @returns {Promise<void>}
   */
  async updateAgreement(agreementId, agreementData) {
    const { agreementName, agreementContent, statusId } = agreementData;

    await db.run(
      'UPDATE Agreements SET AgreementName = ?, AgreementContent = ?, StatusID = ? WHERE AgreementID = ?',
      [agreementName, agreementContent, statusId, agreementId]
    );
  },

  /**
   * Delete an agreement
   * @param {number} agreementId - Agreement ID
   * @returns {Promise<void>}
   */
  async deleteAgreement(agreementId) {
    await db.run('DELETE FROM Agreements WHERE AgreementID = ?', [agreementId]);
  }
};

module.exports = agreementService;
