/**
 * Seed test data for testing GIC purchases
 */

const db = require('./db');
const { STATUS, TRANSACTION_TYPES, ACCOUNT_TYPES } = require('../services/constants');

console.log('=== Seeding Test Data ===\n');

// Find the admin user and their chequing account
db.get('SELECT UserID FROM Users WHERE Username = ?', ['admin'], (err, user) => {
  if (err || !user) {
    console.error('Error finding admin user:', err);
    db.close();
    return;
  }

  console.log(`Found user: admin (ID: ${user.UserID})`);

  // Get or create chequing account
  db.get(`
    SELECT AccountID FROM Accounts
    WHERE UserID = ? AND AccountTypeID = ?
  `, [user.UserID, ACCOUNT_TYPES.CHEQUING], (err, account) => {
    if (err) {
      console.error('Error finding account:', err);
      db.close();
      return;
    }

    let accountId;
    if (account) {
      accountId = account.AccountID;
      console.log(`Found existing chequing account: ${accountId}`);
      seedTransactions(accountId);
    } else {
      // Create chequing account
      db.run(`
        INSERT INTO Accounts (UserID, AccountTypeID, StatusID)
        VALUES (?, ?, ?)
      `, [user.UserID, ACCOUNT_TYPES.CHEQUING, STATUS.ACTIVE], function(err) {
        if (err) {
          console.error('Error creating account:', err);
          db.close();
          return;
        }
        accountId = this.lastID;
        console.log(`Created new chequing account: ${accountId}`);
        seedTransactions(accountId);
      });
    }
  });
});

function seedTransactions(accountId) {
  console.log('\nAdding test transactions...');

  // Add an APPROVED deposit of $5000
  db.run(`
    INSERT INTO Transactions (
      AccountID, TransactionTypeID, Amount, Date,
      Description, StatusID
    ) VALUES (?, ?, ?, date('now'), ?, ?)
  `, [
    accountId,
    TRANSACTION_TYPES.DEPOSIT,
    5000,
    'Initial deposit - Test data',
    STATUS.APPROVED
  ], function(err) {
    if (err) {
      console.error('Error creating transaction:', err);
      db.close();
      return;
    }

    console.log(`✓ Created APPROVED deposit of $5000 (Transaction ID: ${this.lastID})`);

    // Verify the balance
    db.get(`
      SELECT SUM(Amount * CASE WHEN TransactionTypeID = 1 THEN 1 ELSE -1 END) AS total
      FROM Transactions
      JOIN Status ON Transactions.StatusID = Status.StatusID
      WHERE AccountID = ?
        AND (Status.StatusName = 'Approved' OR Status.StatusName = 'Paid Off')
    `, [accountId], (err, result) => {
      if (err) {
        console.error('Error checking balance:', err);
      } else {
        console.log(`\n✓ Approved balance for account ${accountId}: $${result.total || 0}`);
        console.log('\nYou can now test GIC purchases!');
      }
      db.close();
    });
  });
}
