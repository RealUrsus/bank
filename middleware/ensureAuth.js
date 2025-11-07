module.exports = function ensureAuthenticated(req, res, next) {
    if (!req.isAuthenticated?.()) {
      if (req.session) {
        req.session.returnTo = req.originalUrl || req.url;
      }
      return res.redirect('/login');
    }
    next();
};  