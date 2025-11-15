const sqlite3 = require('sqlite3').verbose();
const mkdirp = require('mkdirp');
const crypto = require('crypto');
const path = require('path');
const { ROLES, PASSWORD_CONFIG } = require('../services/constants');

// Get database path from environment variable or use default
const dbPath = process.env.DATABASE_PATH || './var/db/bank.db';
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
mkdirp.sync(dbDir);

let db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    console.error('Database path:', dbPath);
    process.exit(1);
  }
  console.log('Connected to SQLite database at', dbPath);
});

db.serialize(() => {
  db.run("BEGIN TRANSACTION");

  // Helper Tables
  db.run(`CREATE TABLE IF NOT EXISTS AccountTypes (
      AccountTypeID INTEGER PRIMARY KEY AUTOINCREMENT,
      AccountTypeName TEXT NOT NULL UNIQUE COLLATE NOCASE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Roles (
      RoleID INTEGER PRIMARY KEY AUTOINCREMENT,
      RoleName TEXT NOT NULL UNIQUE COLLATE NOCASE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS TransactionTypes (
    TransactionTypeID INTEGER PRIMARY KEY AUTOINCREMENT,
    TransactionTypeName TEXT NOT NULL UNIQUE COLLATE NOCASE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Status (
    StatusID INTEGER PRIMARY KEY AUTOINCREMENT,
    StatusName TEXT NOT NULL UNIQUE COLLATE NOCASE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS LoanTypes (
    LoanTypeID INTEGER PRIMARY KEY AUTOINCREMENT,
    LoanTypeName TEXT NOT NULL UNIQUE COLLATE NOCASE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS PaymentFrequencies (
    PaymentFrequencyID INTEGER PRIMARY KEY,
    PaymentFrequencyName TEXT NOT NULL UNIQUE COLLATE NOCASE
  )`);


  // Main Tables
  db.run(`CREATE TABLE IF NOT EXISTS Accounts (
      AccountID INTEGER PRIMARY KEY AUTOINCREMENT,
      AccountTypeID INTEGER NOT NULL,
      UserID INTEGER NOT NULL,
      CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      Balance REAL NOT NULL DEFAULT 0.0,
      MinimumBalance REAL DEFAULT 0.0,
      PrincipalAmount REAL DEFAULT 0.0,
      InterestRate REAL DEFAULT 0.0,
      Term INTEGER DEFAULT NULL,
      PaymentFrequency TEXT DEFAULT NULL,
      PaymentFrequencyID INTEGER DEFAULT NULL,
      StartDate DATE DEFAULT NULL,
      StatusID INTEGER DEFAULT 1 NOT NULL,
      Description TEXT DEFAULT NULL,
      FOREIGN KEY (AccountTypeID) REFERENCES AccountTypes(AccountTypeID),
      FOREIGN KEY (UserID) REFERENCES Users(UserID),
      FOREIGN KEY (PaymentFrequencyID) REFERENCES PaymentFrequencies(PaymentFrequencyID)
  )`);

  // Migration: Add PaymentFrequency column if it doesn't exist
  db.run(`ALTER TABLE Accounts ADD COLUMN PaymentFrequency TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding PaymentFrequency column:', err);
    }
  });

  // Migration: Add PaymentFrequencyID column if it doesn't exist
  db.run(`ALTER TABLE Accounts ADD COLUMN PaymentFrequencyID INTEGER DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding PaymentFrequencyID column:', err);
    }
  });

  // Migration: Add Category column to Transactions table if it doesn't exist
  db.run(`ALTER TABLE Transactions ADD COLUMN Category TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding Category column:', err);
    }
  });

  // Migration: Add ProductID column to Accounts table for GIC product linking
  db.run(`ALTER TABLE Accounts ADD COLUMN ProductID INTEGER DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding ProductID column:', err);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS Users (
      UserID INTEGER PRIMARY KEY AUTOINCREMENT,
      Username TEXT NOT NULL UNIQUE,
      HashedPassword BLOB,
      Salt BLOB,
      Name TEXT(32) NOT NULL,
      Surname TEXT(32) NOT NULL,
      RoleID INTEGER NOT NULL,
      FOREIGN KEY (RoleID) REFERENCES Roles(RoleID)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Transactions (
      TransactionID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      AccountID INTEGER NOT NULL,
      TransactionTypeID INTEGER NOT NULL,
      Amount REAL NOT NULL,      
      Date DATE NOT NULL,      
      CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      Description TEXT NOT NULL,
      TransferID INTEGER,     -- Groups related transactions (e.g., transfer debit/credit)
      StatusID INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (AccountID) REFERENCES Accounts(AccountID),
      FOREIGN KEY (TransactionTypeID) REFERENCES TransactionTypes(TransactionTypeID),
      FOREIGN KEY (StatusID) REFERENCES Status(StatusID)
  )`);


  db.run(`CREATE TABLE IF NOT EXISTS Agreements (
    AgreementID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    AgreementName TEXT NOT NULL,
    AgreementContent TEXT NOT NULL,
    StatusID INTEGER DEFAULT 1 NOT NULL,
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (StatusID) REFERENCES Status(StatusID)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS GICProducts (
    ProductID INTEGER PRIMARY KEY AUTOINCREMENT,
    ProductName TEXT NOT NULL,
    InterestRate REAL NOT NULL,
    Term INTEGER NOT NULL,
    MinimumAmount REAL NOT NULL DEFAULT 100.0,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seeding Data
  db.run("INSERT OR IGNORE INTO AccountTypes (AccountTypeName) VALUES ('Chequing'), ('Loan'), ('Saving'), ('Investment')");
  db.run("INSERT OR IGNORE INTO Roles (RoleName) VALUES ('Admin'), ('Auditor'), ('Client')");
  db.run("INSERT OR IGNORE INTO TransactionTypes (TransactionTypeName) VALUES ('Deposit'), ('Withdrawal'), ('Transfer')");
  db.run("INSERT OR IGNORE INTO Status (StatusName) VALUES ('Pending'), ('Approved'), ('Rejected'), ('Active'), ('Closed'), ('Paid Off')");
  db.run("INSERT OR IGNORE INTO PaymentFrequencies (PaymentFrequencyID, PaymentFrequencyName) VALUES (0, 'Bi-weekly'), (1, 'Monthly'), (2, 'Annually'), (3, 'At Maturity')");

  // Migration: Migrate existing PaymentFrequency TEXT values to PaymentFrequencyID
  db.run(`UPDATE Accounts
          SET PaymentFrequencyID = CASE
            WHEN lower(PaymentFrequency) = 'monthly' THEN 1
            WHEN lower(PaymentFrequency) = 'annually' THEN 2
            WHEN lower(PaymentFrequency) = 'annual' THEN 2
            ELSE NULL
          END
          WHERE PaymentFrequency IS NOT NULL AND PaymentFrequencyID IS NULL`, (err) => {
    if (err) {
      console.error('Error migrating PaymentFrequency data:', err);
    }
  });

  // Migration: Migrate GIC product IDs from Description to ProductID column
  db.run(`UPDATE Accounts
          SET ProductID = CAST(Description AS INTEGER)
          WHERE AccountTypeID = 4
            AND Description IS NOT NULL
            AND ProductID IS NULL
            AND Description GLOB '[0-9]*'`, (err) => {
    if (err) {
      console.error('Error migrating GIC ProductID data:', err);
    }
  });


  // Create initial admin user
  let salt = crypto.randomBytes(PASSWORD_CONFIG.SALT_BYTES);
  db.run(`INSERT OR IGNORE INTO Users (Username, HashedPassword, Salt, Name, Surname, RoleID) VALUES (?, ?, ?, ?, ?, ?)`, [
      'admin',
      crypto.pbkdf2Sync(
        'admin',
        salt,
        PASSWORD_CONFIG.PBKDF2_ITERATIONS,
        PASSWORD_CONFIG.HASH_LENGTH,
        PASSWORD_CONFIG.DIGEST
      ),
      salt,
      'Bank',
      'Admin',
      ROLES.ADMIN
  ]);

  db.run("COMMIT");
});

module.exports = db;