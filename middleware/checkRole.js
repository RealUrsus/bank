/**
 * Middleware function to check if the user has the required role.
 *
 * @param {string} requiredRole - The role required to access the route.
 * @returns {function} - A middleware function that checks the user's role.
 */
function checkRole(requiredRole) {  
  return (req, res, next) => {
    if (req.user.role === req.roles[requiredRole]) {
      return next();
    }
    res.status(401).send('Unauthorized');
  };
}

module.exports = checkRole;