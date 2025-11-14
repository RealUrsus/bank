/**
 * Migration script to consolidate APPROVED status to ACTIVE for loans and GICs
 * Run this once to migrate existing data
 */

const db = require('./db');

console.log('Starting status migration...');

db.serialize(() => {
  db.run("BEGIN TRANSACTION");

  // Update all loan accounts from APPROVED (2) to ACTIVE (4)
  db.run(
    `UPDATE Accounts
     SET StatusID = 4
     WHERE AccountTypeID = 2
       AND StatusID = 2`,
    function(err) {
      if (err) {
        console.error('Error updating loan accounts:', err);
        db.run("ROLLBACK");
        return;
      }
      console.log(`✓ Updated ${this.changes} loan account(s) from APPROVED to ACTIVE`);
    }
  );

  // Update all GIC/investment accounts from APPROVED (2) to ACTIVE (4)
  db.run(
    `UPDATE Accounts
     SET StatusID = 4
     WHERE AccountTypeID = 4
       AND StatusID = 2`,
    function(err) {
      if (err) {
        console.error('Error updating GIC accounts:', err);
        db.run("ROLLBACK");
        return;
      }
      console.log(`✓ Updated ${this.changes} GIC account(s) from APPROVED to ACTIVE`);
    }
  );

  db.run("COMMIT", function(err) {
    if (err) {
      console.error('Error committing transaction:', err);
      return;
    }
    console.log('✓ Migration completed successfully!');
    db.close();
  });
});
