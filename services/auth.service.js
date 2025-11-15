/**
 * Authentication service
 * Handles user authentication and signup operations
 */

const crypto = require('crypto');
const db = require('./database.service');
const cryptoUtils = require('../utils/crypto');
const { ROLES } = require('./constants');

const authService = {
  /**
   * Verify user credentials
   * @param {string} username - Username
   * @param {string} password - Password to verify
   * @returns {Promise<object|null>} User object if credentials are valid, null otherwise
   */
  async verifyCredentials(username, password) {
    const user = await db.queryOne(
      'SELECT * FROM Users WHERE Username = ?',
      [username]
    );

    if (!user) {
      return null;
    }

    // Verify password using shared crypto utilities
    const isValid = await cryptoUtils.verifyPassword(
      password,
      user.HashedPassword,
      user.Salt
    );

    if (!isValid) {
      return null;
    }

    return user;
  },

  /**
   * Create a new user account
   * @param {object} userData - User registration data
   * @param {string} userData.username - Username
   * @param {string} userData.password - Plain text password
   * @param {string} userData.name - First name
   * @param {string} userData.surname - Last name
   * @param {number} userData.roleId - Role ID (defaults to CLIENT)
   * @returns {Promise<object>} Created user object with id and username
   */
  async createUser(userData) {
    const {
      username,
      password,
      name,
      surname,
      roleId = ROLES.CLIENT
    } = userData;

    // Check if username already exists (Fix #2)
    const existingUser = await this.usernameExists(username);
    if (existingUser) {
      const error = new Error('Username already exists');
      error.status = 400;
      throw error;
    }

    // Generate salt and hash password using shared crypto utilities
    const { hash, salt } = await cryptoUtils.hashPassword(password);

    // Insert user into database
    const result = await db.run(
      'INSERT INTO Users (Username, HashedPassword, Salt, Name, Surname, RoleID) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hash, salt, name, surname, roleId]
    );

    return {
      id: result.lastID,
      username
    };
  },

  /**
   * Check if a username already exists
   * @param {string} username - Username to check
   * @returns {Promise<boolean>} True if username exists, false otherwise
   */
  async usernameExists(username) {
    const user = await db.queryOne(
      'SELECT UserID FROM Users WHERE Username = ?',
      [username]
    );
    return !!user;
  }
};

module.exports = authService;
