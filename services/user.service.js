/**
 * User service
 * Handles user operations including authentication and password management
 */

const crypto = require('crypto');
const db = require('./database.service');
const { PASSWORD_CONFIG, ROLES } = require('./constants');

const userService = {
  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {Promise<object|null>} User record (without password)
   */
  async getUser(userId) {
    return await db.queryOne(
      'SELECT UserID, Username, Name, Surname, RoleID FROM Users WHERE UserID = ?',
      [userId]
    );
  },

  /**
   * Get user with password data (for authentication)
   * @param {number} userId - User ID
   * @returns {Promise<object|null>} User record with hashed password and salt
   */
  async getUserWithPassword(userId) {
    return await db.queryOne(
      'SELECT * FROM Users WHERE UserID = ?',
      [userId]
    );
  },

  /**
   * Get all client users
   * @returns {Promise<Array>} Array of client users
   */
  async getAllClients() {
    return await db.queryMany(
      'SELECT UserID, Name, Surname, Username FROM Users WHERE RoleID = ?',
      [ROLES.CLIENT]
    );
  },

  /**
   * Update user information
   * @param {number} userId - User ID
   * @param {object} userData - User data to update
   * @returns {Promise<void>}
   */
  async updateUser(userId, userData) {
    const { username, name, surname } = userData;

    await db.run(
      'UPDATE Users SET Username = ?, Name = ?, Surname = ? WHERE UserID = ?',
      [username, name, surname, userId]
    );
  },

  /**
   * Hash a password using PBKDF2
   * @param {string} password - Plain text password
   * @param {Buffer} salt - Salt (if not provided, generates new one)
   * @returns {Promise<object>} Object with hash and salt
   */
  async hashPassword(password, salt = null) {
    const saltBuffer = salt || crypto.randomBytes(PASSWORD_CONFIG.SALT_BYTES);

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        saltBuffer,
        PASSWORD_CONFIG.PBKDF2_ITERATIONS,
        PASSWORD_CONFIG.HASH_LENGTH,
        PASSWORD_CONFIG.DIGEST,
        (err, hash) => {
          if (err) return reject(err);
          resolve({
            hash,
            salt: saltBuffer
          });
        }
      );
    });
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
   * Change user password
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<object>} Result object with success status and message
   */
  async changePassword(userId, currentPassword, newPassword) {
    // Validate new password length
    if (newPassword.length < PASSWORD_CONFIG.MIN_LENGTH) {
      return {
        success: false,
        message: `New password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters long`
      };
    }

    // Get user with password data
    const user = await this.getUserWithPassword(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Verify current password
    const isValid = await this.verifyPassword(
      currentPassword,
      user.HashedPassword,
      user.Salt
    );

    if (!isValid) {
      return {
        success: false,
        message: 'Current password is incorrect'
      };
    }

    // Hash new password
    const { hash, salt } = await this.hashPassword(newPassword);

    // Update password in database
    await db.run(
      'UPDATE Users SET HashedPassword = ?, Salt = ? WHERE UserID = ?',
      [hash, salt, userId]
    );

    return {
      success: true,
      message: 'Password changed successfully'
    };
  },

  /**
   * Validate password requirements
   * @param {string} password - Password to validate
   * @returns {object} Validation result with isValid and message
   */
  validatePasswordRequirements(password) {
    if (!password || password.length < PASSWORD_CONFIG.MIN_LENGTH) {
      return {
        isValid: false,
        message: `Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters long`
      };
    }

    return {
      isValid: true,
      message: 'Password meets requirements'
    };
  },

  /**
   * Check if passwords match
   * @param {string} password - Password
   * @param {string} confirmPassword - Confirmation password
   * @returns {boolean} True if passwords match
   */
  passwordsMatch(password, confirmPassword) {
    return password === confirmPassword;
  }
};

module.exports = userService;
