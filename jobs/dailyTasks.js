const cron = require('node-cron');
const db = require('../utils/db.js');

async function getBalance(accountId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT SUM(amount * CASE WHEN TransactionTypeID = 1 THEN 1 ELSE -1 END) AS total FROM Transactions WHERE AccountID = ?', [accountId], (err, row) => {
      if (err) return reject(err);
      resolve(row?.total || 0); // Default to 0 if no balance found
    });
  });
}

async function fetchLoans() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Accounts WHERE AccountTypeID = 2 AND StatusID = 2',  (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}


async function runDailyTask() {
  const loans = await fetchLoans(); 
  // Iterate through the loans array
  for (const loan of loans) {

    const balance = await getBalance(loan.AccountID);
    if (loan.PrincipalAmount <= balance) {
      await new Promise((resolve, reject) => {
        db.run('UPDATE Accounts SET StatusID = 6 WHERE AccountID = ?', [loan.AccountID], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  }
}

cron.schedule('0 0 * * *', async () => {
  await runDailyTask();
});