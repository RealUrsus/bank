/**
 * Authentication service
 * Handles user authentication and signup operations
 */

const crypto = require('crypto');
const { promisify } = require('util');
const db = require('./database.service');
const { ROLES, PASSWORD_CONFIG } = require('./constants');

// Promisify crypto.pbkdf2 for async/await usage
const pbkdf2 = promisify(crypto.pbkdf2);

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

    // Hash the provided password with the user's salt
    const hashedPassword = await pbkdf2(
      password,
      user.Salt,
      PASSWORD_CONFIG.PBKDF2_ITERATIONS,
      PASSWORD_CONFIG.HASH_LENGTH,
      PASSWORD_CONFIG.DIGEST
    );

    // Use timing-safe comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(user.HashedPassword, hashedPassword)) {
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

    // Generate salt and hash password
    const salt = crypto.randomBytes(PASSWORD_CONFIG.SALT_BYTES);
    const hashedPassword = await pbkdf2(
      password,
      salt,
      PASSWORD_CONFIG.PBKDF2_ITERATIONS,
      PASSWORD_CONFIG.HASH_LENGTH,
      PASSWORD_CONFIG.DIGEST
    );

    // Insert user into database
    const result = await db.run(
      'INSERT INTO Users (Username, HashedPassword, Salt, Name, Surname, RoleID) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, salt, name, surname, roleId]
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
