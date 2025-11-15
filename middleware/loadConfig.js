const configService = require('../helpers/configService.js');

/**
 * Middleware to load configuration for all routes
 * Attaches roles configuration to req.roles for use in route handlers
 */
async function loadConfig(req, res, next) {
  try {
    const roles = await configService.getConfig('Roles');
    req.roles = roles;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = loadConfig;
