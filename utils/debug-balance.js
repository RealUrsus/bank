/**
 * Debug script to check balance calculation
 */

const db = require('./db');

console.log('=== Checking Balance Calculation ===\n');

// Get all Status records
db.all('SELECT * FROM Status ORDER BY StatusID', (err, statuses) => {
  if (err) {
    console.error('Error fetching statuses:', err);
    return;
  }

  console.log('Available statuses:');
  statuses.forEach(s => {
    console.log(`  ${s.StatusID}: ${s.StatusName}`);
  });
  console.log('');

  // Get all transactions
  db.all(`
    SELECT t.*, s.StatusName, tt.TransactionTypeName
    FROM Transactions t
    JOIN Status s ON t.StatusID = s.StatusID
    JOIN TransactionTypes tt ON t.TransactionTypeID = tt.TransactionTypeID
    ORDER BY t.TransactionID DESC
    LIMIT 10
  `, (err, transactions) => {
    if (err) {
      console.error('Error fetching transactions:', err);
      return;
    }

    console.log('Recent transactions:');
    transactions.forEach(t => {
      console.log(`  ID: ${t.TransactionID}, Account: ${t.AccountID}, Type: ${t.TransactionTypeName}, Amount: $${t.Amount}, Status: ${t.StatusName} (${t.StatusID})`);
    });
    console.log('');

    // Test getApprovedBalance query for each account
    db.all(`
      SELECT DISTINCT AccountID FROM Transactions
    `, (err, accounts) => {
      if (err) {
        console.error('Error fetching accounts:', err);
        return;
      }

      console.log('Balance calculations per account:');
      accounts.forEach(acc => {
        // Total balance (all transactions)
        db.get(`
          SELECT SUM(Amount * CASE WHEN TransactionTypeID = 1 THEN 1 ELSE -1 END) AS total
          FROM Transactions
          WHERE AccountID = ?
        `, [acc.AccountID], (err, totalResult) => {
          if (err) {
            console.error('Error calculating total:', err);
            return;
          }

          // Approved balance (old query - checking for 'Approved')
          db.get(`
            SELECT SUM(Amount * CASE WHEN TransactionTypeID = 1 THEN 1 ELSE -1 END) AS total
            FROM Transactions
            JOIN Status ON Transactions.StatusID = Status.StatusID
            WHERE AccountID = ?
              AND (Status.StatusName = 'Approved' OR Status.StatusName = 'Paid Off')
          `, [acc.AccountID], (err, approvedResult) => {
            if (err) {
              console.error('Error calculating approved:', err);
              return;
            }

            // Active balance (checking for 'Active')
            db.get(`
              SELECT SUM(Amount * CASE WHEN TransactionTypeID = 1 THEN 1 ELSE -1 END) AS total
              FROM Transactions
              JOIN Status ON Transactions.StatusID = Status.StatusID
              WHERE AccountID = ?
                AND (Status.StatusName = 'Active' OR Status.StatusName = 'Paid Off')
            `, [acc.AccountID], (err, activeResult) => {
              if (err) {
                console.error('Error calculating active:', err);
                return;
              }

              console.log(`  Account ${acc.AccountID}:`);
              console.log(`    Total balance: $${totalResult.total || 0}`);
              console.log(`    Approved balance: $${approvedResult.total || 0}`);
              console.log(`    Active balance: $${activeResult.total || 0}`);
            });
          });
        });
      });

      setTimeout(() => {
        db.close();
      }, 1000);
    });
  });
});
