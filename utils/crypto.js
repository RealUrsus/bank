/**
 * Cryptographic utilities
 * Centralized password hashing and verification
 */

const crypto = require('crypto');
const { promisify } = require('util');
const { PASSWORD_CONFIG } = require('../services/constants');

// Promisify crypto.pbkdf2 for async/await usage
const pbkdf2 = promisify(crypto.pbkdf2);

const cryptoUtils = {
  /**
   * Hash a password using PBKDF2
   * @param {string} password - Plain text password
   * @param {Buffer} salt - Salt (if not provided, generates new one)
   * @returns {Promise<object>} Object with hash and salt buffers
   */
  async hashPassword(password, salt = null) {
    const saltBuffer = salt || crypto.randomBytes(PASSWORD_CONFIG.SALT_BYTES);

    const hash = await pbkdf2(
      password,
      saltBuffer,
      PASSWORD_CONFIG.PBKDF2_ITERATIONS,
      PASSWORD_CONFIG.HASH_LENGTH,
      PASSWORD_CONFIG.DIGEST
    );

    return {
      hash,
      salt: saltBuffer
    };
  },

  /**
   * Verify a password against stored hash
   * @param {string} password - Plain text password
   * @param {Buffer} storedHash - Stored hash
   * @param {Buffer} salt - Salt used for hashing
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, storedHash, salt) {
    const { hash } = await this.hashPassword(password, salt);
    return crypto.timingSafeEqual(storedHash, hash);
  },

  /**
   * Generate a secure random token
   * @param {number} bytes - Number of random bytes
   * @returns {string} Hex-encoded random token
   */
  generateToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }
};

module.exports = cryptoUtils;
