const PORT = process.env.PORT || 8000;

const express = require("express");
const app = express();
const session = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
// const helmet = require('helmet');
const passport = require('passport');
const SQLiteStore = require('connect-sqlite3')(session);

// Import Bank scheduled jobs
require('./jobs/dailyTasks');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache for 1 day
}));

app.use(session({
  secret: require("crypto").randomBytes(32).toString("hex"),
  store: new SQLiteStore({ db: 'sessions.db', dir: './var/db' }),
  resave: false,           // don't save session if unmodified
  saveUninitialized: false // don't create session until something stored
}));

app.use(passport.authenticate('session'));

app.use((req, res, next) => { 
  res.locals.message = req.session.message || null;
  req.session.message = null;
  next();
});

app.use(csrf());
app.use((req, res, next) => {
  if (['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.locals.csrfToken = req.csrfToken();
  }
  next();
});

(async () => {
  try {
    // Main routes
    app.get("/", (req, res) => res.render("home"));
    app.get("/about", (req, res) => res.render("about"));
    app.use('/', require("./routes/auth.js"));
    app.use('/client', require("./routes/client.js"));
    app.use('/admin', require("./routes/admin.js"));

    // ✅ 404 handler (Express 5–compatible)
    app.use((req, res) => {
      res.status(404)
         .type('text/plain')
         .send(`Error: ${req.originalUrl} was not found`);
    });

    // ✅ Global error handler (after all routes)
    app.use((err, req, res, next) => {
      // Handle CSRF token errors by redirecting to login
      if (err.code === 'EBADCSRFTOKEN' || (err.message && err.message.includes('csrf'))) {
        req.session.message = 'Your session has expired. Please log in again.';
        return res.redirect('/login');
      }

      console.error(err.stack);
      res.status(err.status || 500)
         .type('text/plain')
         .send(`Error: ${err.message}`);
    });

    // Start Server
    const server = app.listen(PORT, () => 
      console.log(`Bank app is listening on port ${PORT}`)
    );

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log("Shutting down gracefully...");
      server.close(() => {
        console.log("Closed all connections.");
        process.exit(0);
      });
    });

    process.on('uncaughtException', (err) => {
      console.error("Uncaught Exception:", err);
      process.exit(1);
    });

  } catch (err) {
    console.error(err.stack);
  }
})();