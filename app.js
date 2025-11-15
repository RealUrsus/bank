// Load environment variables from .env file
require('dotenv').config();

const PORT = process.env.PORT || 8000;

const express = require("express");
const app = express();
const session = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const { csrfSync } = require('csrf-sync');
const helmet = require('helmet');
const passport = require('passport');
const SQLiteStore = require('connect-sqlite3')(session);

// Import Bank scheduled jobs
require('./jobs/dailyTasks');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Disable the strictTransportSecurity and contentSecurityPolicy middleware
app.use(helmet({ strictTransportSecurity: false, contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache for 1 day
}));

// Warn if using default session secret
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret === 'dev-secret-change-in-production') {
  console.warn('WARNING: Using default session secret. Set SESSION_SECRET environment variable in production!');
}

app.use(session({
  secret: sessionSecret || 'dev-secret-change-in-production',
  store: new SQLiteStore({
    db: process.env.SESSION_DB_PATH || './var/db/sessions.db',
    dir: './'
  }),
  resave: false,           // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  cookie: {
    httpOnly: true,                               // Prevent XSS
    sameSite: 'strict',                           // CSRF protection
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    maxAge: 24 * 60 * 60 * 1000                   // 24 hours
  }
}));

app.use(passport.authenticate('session'));

app.use((req, res, next) => { 
  res.locals.message = req.session.message || null;
  req.session.message = null;
  next();
});

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => {
    return req.body._csrf || req.query._csrf || req.headers['x-csrf-token'];
  },
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  cookie: {
    name: "_csrf",
    httpOnly: true,
    sameSite: "strict",
    path: "/"
  }
});

app.use(csrfSynchronisedProtection);

// Make CSRF token available to all views
app.use((req, res, next) => {
  try {
    res.locals.csrfToken = generateToken(req, res);
    next();
  } catch (err) {
    next(err);
  }
});

// Main routes
app.get("/", (req, res) => res.render("home"));
app.get("/about", (req, res) => res.render("about"));
app.use('/', require("./routes/auth.js"));
app.use('/client', require("./routes/client.js"));
app.use('/admin', require("./routes/admin.js"));

// 404 handler (Express 5–compatible)
app.use((req, res) => {
  res.status(404)
     .type('text/plain')
     .send(`Error: ${req.originalUrl} was not found`);
});

// Global error handler (after all routes)
app.use((err, req, res, next) => {
  // Log all errors for debugging
  console.error('Error caught:', {
    code: err.code,
    message: err.message,
    url: req.url,
    method: req.method,
    stack: err.stack
  });

  // Handle CSRF token errors by redirecting to login
  if (err.code === 'EBADCSRFTOKEN' || (err.message && (err.message.toLowerCase().includes('csrf')))) {
    req.session.message = 'Your session has expired. Please log in again.';
    return res.redirect('/login');
  }

  // Determine status code
  const status = err.status || 500;

  // In production, hide internal error details
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'An internal server error occurred'
    : err.message;

  res.status(status)
     .type('text/plain')
     .send(`Error: ${message}`);
});

// Server initialization function
async function startServer() {
  try {
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

    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server
startServer();