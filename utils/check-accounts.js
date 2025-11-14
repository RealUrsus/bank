const db = require('./db');

console.log('=== Checking Accounts ===\n');

db.all(`
  SELECT a.*, at.AccountTypeName, s.StatusName, u.Username
  FROM Accounts a
  JOIN AccountTypes at ON a.AccountTypeID = at.AccountTypeID
  JOIN Status s ON a.StatusID = s.StatusID
  JOIN Users u ON a.UserID = u.UserID
`, (err, accounts) => {
  if (err) {
    console.error('Error:', err);
    return;
  }

  console.log('All accounts:');
  accounts.forEach(a => {
    console.log(`  Account ${a.AccountID}:`);
    console.log(`    User: ${a.Username} (ID: ${a.UserID})`);
    console.log(`    Type: ${a.AccountTypeName}`);
    console.log(`    Status: ${a.StatusName} (${a.StatusID})`);
    console.log(`    Balance column: $${a.Balance || 0}`);
    console.log(`    Principal: $${a.PrincipalAmount || 0}`);
    console.log('');
  });

  db.close();
});
