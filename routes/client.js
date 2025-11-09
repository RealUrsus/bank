const express = require('express');
const crypto = require('crypto');
const checkRole = require('../middleware/checkRole.js');
const configService = require('../helpers/configService.js');
const ensureAuthenticated = require('../middleware/ensureAuth.js');
const getAccountID = require('../middleware/getAccountID.js');
const db = require('../utils/db.js');

const router = express.Router();

// Middleware to load config for all routes handled by this router
router.use(async (req, res, next) => {
  try {
      const roles = await configService.getConfig('Roles');
      req.roles = roles; // Attach the loaded config to the request object
      next(); // Pass control to the next middleware or route handler
  } catch (error) {
      next(error);
  }
});

// Format a date as 'YYYY-MM-DD'
const formatDate = (date) => date.toISOString().split('T')[0];

// Count both approved and non approved transactions
async function getBalance(accountId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT SUM(amount * CASE WHEN TransactionTypeID = 1 THEN 1 ELSE -1 END) AS total FROM Transactions WHERE AccountID = ?', [accountId], (err, row) => {
      if (err) return reject(err);
      resolve(row?.total || 0); // Default to 0 if no balance found
    });
  });
}

// Get the total approved amount from transactions
async function getApprovedBalance(accountId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT SUM(amount * CASE WHEN TransactionTypeID = 1 THEN 1 ELSE -1 END) AS total
              FROM Transactions
              JOIN Status ON Transactions.StatusID = Status.StatusID
              WHERE 
                AccountID = ? 
                AND (Status.StatusName = 'Approved' OR Status.StatusName = 'Paid Off');`,
        [accountId], (err, row) => {
      if (err) return reject(err);
      resolve(row?.total || 0); // Default to 0 if no balance found
    });
  });
}

async function getTransactions(req, res, next) {
  const period = parseInt(req.params.period, 10) || 30; // Default to 30 if parsing fails

  if (period < 0 || period > 365) {
    return res.status(400).send('Invalid period');
  }

  try {
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM Transactions WHERE AccountID = ? AND Date >= ? AND Date <= ? ORDER BY Date ASC', [
        req.user.account,
        formatDate(new Date(Date.now() - period * 24 * 60 * 60 * 1000)),
        formatDate(new Date())
      ], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    // Map transaction rows to the desired format
    res.locals.transactions = rows.map(row => ({
      ...row
    }));
    next();
  } catch (err) {
    next(err);
  }
}

async function fetchAccount(accountId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Accounts WHERE AccountID = ?', [accountId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function fetchLoans(req, res, next) {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all(`SELECT 
                Accounts.*,
                Status.StatusName AS Status
             FROM 
                Accounts
             INNER JOIN 
                Status 
             ON 
                Accounts.StatusID = Status.StatusID
             WHERE 
                Accounts.UserID = ? 
                AND Accounts.AccountTypeID = 2
                AND ( Status.StatusName = 'Approved' OR Status.StatusName = 'Paid Off')
             ORDER BY 
                Accounts.StartDate ASC`, [
        req.user.id
      ], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    res.locals.loans = rows.map(row => ({
      ...row 
    }));
    next();
  } catch (err) {
    next(err);
  }
}

async function fetchAgreement(agreemetId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT u.Name, u.Surname, a.AgreementID, a.AgreementName, a.AgreementContent, s.StatusName
      FROM Users u
        INNER JOIN Agreements a ON u.UserID = a.UserID
        INNER JOIN Status s ON a.StatusID = s.StatusID
      WHERE a.AgreementID = ?`, 
      [agreemetId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
    });
  });
}

async function fetchAgreements() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT u.Name, u.Surname, a.AgreementID, a.AgreementName, s.StatusName 
      FROM Users u 
        INNER JOIN Agreements a ON u.UserID = a.UserID 
        INNER JOIN Status s ON a.StatusID = s.StatusID`, 
      (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function fetchTransactions(accountId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Transactions WHERE AccountID = ? ORDER BY Date ASC', [
      accountId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function fetchGICProducts() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM GICProducts ORDER BY ProductID DESC`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function fetchGICProduct(productId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM GICProducts WHERE ProductID = ?`, [productId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function fetchMyGICs(userId) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT
              a.*,
              gp.ProductName
            FROM Accounts a
            LEFT JOIN GICProducts gp ON a.Description = CAST(gp.ProductID AS TEXT)
            WHERE a.UserID = ? AND a.AccountTypeID = 4
            ORDER BY a.StartDate DESC`, [userId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Reducing redundancy
router.use(ensureAuthenticated, checkRole("CLIENT"));

// Route handlers
router.get('/', async (req, res) => {
  try {
  const accountID = await getAccountID(req.user.id, "Chequing");
  req.user["account"] = accountID;
    res.render('client', { 
      user: req.user
     });
  } catch (error) {
    console.error('Error in getAccountID:', error);
    res.status(500).json({ error: 'Internal server error' });
}
});

// Default transactions route (30 days)
router.get('/transactions', getTransactions, async (req, res) => {
  res.locals.filter = null;
  const balance = await getBalance(req.user.account);
  const approved_balance = await getApprovedBalance(req.user.account);
  res.render('client-transactions', { user: req.user, balance, approved_balance });
});

// Transactions route with period parameter
router.get('/transactions/:period', getTransactions, async (req, res) => {
  res.locals.filter = null;
  const balance = await getBalance(req.user.account);
  const approved_balance = await getApprovedBalance(req.user.account);
  res.render('client-transactions', { user: req.user, balance, approved_balance });
});


router.post('/transactions/add', (req, res, next) => {
  const { amount, type, date, description } = req.body;

  if (!amount || !type || !date || !description) {
    return res.status(400).send('All fields are required.');
  }

  // Validate that date is not in the future
  const transactionDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for fair comparison
  transactionDate.setHours(0, 0, 0, 0);

  if (transactionDate > today) {
    return res.status(400).send('Transaction date cannot be in the future.');
  }

  db.run(
    'INSERT INTO Transactions (AccountID, TransactionTypeID, Amount, Date, Description) VALUES (?, ?, ?, ?, ?)',
    [req.user.account, type, amount, date, description],
    // If the insertion is successful, the callback function provided to db.run is called with err being null.
    (err) => {
      if (err) return next(err);
      res.redirect('/client/transactions');
    }
  );
});

router.get('/loan/add', (req, res) => {
  res.locals.filter = null;
  res.render('client-loan-add', { user: req.user });
});

router.post('/loan/add', async (req, res, next) => {
  const { amount, interest, date, term, description, paymentFrequency } = req.body;

  if (!amount || !interest || !date || !term || !description || !paymentFrequency) {
    return res.status(400).send('All fields are required.');
  }

  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO Accounts (UserID, AccountTypeID, InterestRate, PrincipalAmount, Term, StartDate, StatusID, Description, PaymentFrequency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, 2, interest, amount, term, date, 1, description, paymentFrequency],
        function (err) {
          if (err) {
            return reject(err);
          }
          resolve(this); // `this` contains the statement context, including `lastID`
        }
      );
    });

    const loanId = result.lastID;
    res.redirect(`/client/loan/${loanId}`);
  } catch (err) {
    next(err);
  }
});

router.get('/loan/view', fetchLoans, async (req, res, next) => {
  try {
    res.render('client-loans-view', { user: req.user });
  } catch (err) {
      next(err);
  }
});

router.get('/loan/view/:loanId', async (req, res, next) => {
  try {
    const loanId = parseInt(req.params.loanId, 10);

    // Validate loanId
    if (isNaN(loanId) || loanId <= 0) {
      return res.status(400).send('Invalid loanId');
    }

    const account = await fetchAccount(loanId);
    const transactions = await fetchTransactions(loanId);
    const balance = await getBalance(loanId);

    res.render('client-loan-view', { user: req.user, transactions, balance, account });
  } catch (err) {
      next(err);
  }
});

router.get('/loan/:confirmationId', async (req, res, next) => {
  const confirmationId = parseInt(req.params.confirmationId, 10);

  // Validate confirmationId right after parsing it
  if (isNaN(confirmationId) || confirmationId <= 0) {
      return res.status(400).send('Invalid confirmationId');
  }

  try {
    res.render('client-loan-confirmation', { user: req.user, confirmationId: confirmationId });
  } catch (err) {
      next(err);
  }
});

// GIC Routes
router.get('/gic/add', async (req, res, next) => {
  try {
    const gicProducts = await fetchGICProducts();
    const approved_balance = await getApprovedBalance(req.user.account);
    res.render('client-gic-add', { user: req.user, gicProducts, approved_balance });
  } catch (err) {
    next(err);
  }
});

router.post('/gic/purchase/:productId', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const { amount } = req.body;

    if (isNaN(productId) || productId <= 0) {
      return res.status(400).send('Invalid product ID');
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).send('Invalid investment amount');
    }

    const product = await fetchGICProduct(productId);
    if (!product) {
      return res.status(400).send('GIC product not found');
    }

    const investmentAmount = parseFloat(amount);
    if (investmentAmount < product.MinimumAmount) {
      req.session.message = `Minimum investment amount is $${product.MinimumAmount.toFixed(2)}`;
      return res.redirect('/client/gic/add');
    }

    const approved_balance = await getApprovedBalance(req.user.account);
    if (approved_balance <= 0 || approved_balance < investmentAmount) {
      req.session.message = 'Insufficient funds for this investment';
      return res.redirect('/client/gic/add');
    }

    // Create GIC investment account
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO Accounts (UserID, AccountTypeID, InterestRate, PrincipalAmount, Term, StartDate, StatusID, Balance, Description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, 4, product.InterestRate, investmentAmount, product.Term, formatDate(new Date()), 2, investmentAmount, productId.toString()],
        function (err) {
          if (err) return reject(err);
          resolve(this);
        }
      );
    });

    const gicAccountId = result.lastID;

    // Deduct from chequing account
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO Transactions (AccountID, TransactionTypeID, Amount, Date, Description, StatusID) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.account, 2, investmentAmount, formatDate(new Date()), `GIC Investment - ${product.ProductName}`, 2],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    res.redirect(`/client/gic/${gicAccountId}`);
  } catch (err) {
    next(err);
  }
});

router.get('/gic/view', async (req, res, next) => {
  try {
    const gics = await fetchMyGICs(req.user.id);
    res.render('client-gics-view', { user: req.user, gics });
  } catch (err) {
    next(err);
  }
});

router.get('/gic/view/:gicId', async (req, res, next) => {
  try {
    const gicId = parseInt(req.params.gicId, 10);

    if (isNaN(gicId) || gicId <= 0) {
      return res.status(400).send('Invalid gicId');
    }

    const account = await fetchAccount(gicId);
    const transactions = await fetchTransactions(gicId);
    const balance = await getBalance(gicId);

    res.render('client-gic-view', { user: req.user, transactions, balance, account });
  } catch (err) {
    next(err);
  }
});

router.get('/gic/:confirmationId', async (req, res, next) => {
  const confirmationId = parseInt(req.params.confirmationId, 10);

  if (isNaN(confirmationId) || confirmationId <= 0) {
    return res.status(400).send('Invalid confirmationId');
  }

  try {
    const account = await fetchAccount(confirmationId);
    res.render('client-gic-confirmation', { user: req.user, gic: account });
  } catch (err) {
    next(err);
  }
});

router.get('/transfer', fetchLoans, async (req, res, next) => {
  const approved_balance = await getApprovedBalance(req.user.account);
  try {
    res.render('client-transfer', {
      user: req.user,
      account: req.user.account,
      approved_balance: approved_balance
     });
  } catch (err) {
      next(err);
  }
});

router.post('/transfer', async (req, res, next) => {
  const { source, destination, amount } = req.body;

  if (!amount || !destination || !source) {
    return res.status(400).send('All fields are required.');
  }

  let TransferID = Math.floor(Math.random() * 10 ** 12).toString();

  try {
    // Verification
    let src_balance = await getBalance(source);
    let dst_balance = await getBalance(destination);
    let src_account = await fetchAccount(source);
    let dst_account = await fetchAccount(destination);

    if (src_balance <= 0 || src_balance < amount) {
      req.session.message = 'Insufficient funds for transfer';
      return res.redirect('/client/transfer'); // Exit after redirect
    }

    if ((dst_account.PrincipalAmount - dst_balance - amount) < 0 ) {
      req.session.message = 'Too much funds...';
      return res.redirect('/client/transfer'); // Exit after redirect
    }

    // Get account type names for descriptions
    const getAccountTypeName = (accountTypeId) => {
      const types = ['Chequing', 'Loan', 'Saving', 'Investment'];
      return types[accountTypeId - 1] || 'Account';
    };

    const srcAccountType = getAccountTypeName(src_account.AccountTypeID);
    const dstAccountType = getAccountTypeName(dst_account.AccountTypeID);

    // Create descriptive messages
    const destinationDesc = `Internal Transaction from ${srcAccountType} #${source}`;
    const sourceDesc = `Internal Transaction to ${dstAccountType} #${destination}`;

    // Perform database transactions
    db.run(
      'INSERT INTO Transactions (AccountID, TransactionTypeID, Amount, Date, TransferID, Description, StatusID) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [destination, 1, amount, formatDate(new Date()), TransferID, destinationDesc, 2],
      (err) => {
        if (err) return next(err);
      }
    );

    db.run(
      'INSERT INTO Transactions (AccountID, TransactionTypeID, Amount, Date, TransferID, Description, StatusID) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [source, 2, amount, formatDate(new Date()), TransferID, sourceDesc, 2],
      (err) => {
        if (err) return next(err);
      }
    );

    // Redirect after successful transactions
    res.redirect('/client/transactions');
  } catch (err) {
    next(err); // Pass errors to the error-handling middleware
  }
});


router.get('/agreements', async (req, res, next) => {
  try {
    const agreements = await fetchAgreements()
    res.render('client-agreements', { user: req.user, agreements });
  } catch (err) {
      next(err);
  }
});

router.get('/agreements/:agreementId', async (req, res, next) => {
  try {
    const agreementId = parseInt(req.params.agreementId, 10);

    // Validate agreementId
    if (isNaN(agreementId) || agreementId <= 0) {
      return res.status(400).send('Invalid agreementId');
    }

    const agreement = await fetchAgreement(agreementId);
    res.render('client-agreements-view', { user: req.user, agreement });
  } catch (err) {
      next(err);
  }
});

// GET /client/change-password
router.get('/change-password', (req, res) => {
  res.render('change-password', { user: req.user, userRole: 'client' });
});

// POST /client/change-password
router.post('/change-password', async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Validate input
  if (!currentPassword || !newPassword || !confirmPassword) {
    req.session.message = 'All fields are required.';
    return res.redirect('/client/change-password');
  }

  if (newPassword !== confirmPassword) {
    req.session.message = 'New passwords do not match.';
    return res.redirect('/client/change-password');
  }

  if (newPassword.length < 8) {
    req.session.message = 'New password must be at least 8 characters long.';
    return res.redirect('/client/change-password');
  }

  try {
    // Get user's current password hash and salt
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM Users WHERE UserID = ?', [req.user.id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('User not found'));
        resolve(row);
      });
    });

    // Verify current password
    const currentHash = await new Promise((resolve, reject) => {
      crypto.pbkdf2(currentPassword, user.Salt, 310000, 32, 'sha256', (err, hash) => {
        if (err) return reject(err);
        resolve(hash);
      });
    });

    if (!crypto.timingSafeEqual(user.HashedPassword, currentHash)) {
      req.session.message = 'Current password is incorrect.';
      return res.redirect('/client/change-password');
    }

    // Generate new salt and hash for new password
    const newSalt = crypto.randomBytes(16);
    const newHash = await new Promise((resolve, reject) => {
      crypto.pbkdf2(newPassword, newSalt, 310000, 32, 'sha256', (err, hash) => {
        if (err) return reject(err);
        resolve(hash);
      });
    });

    // Update password in database
    await new Promise((resolve, reject) => {
      db.run('UPDATE Users SET HashedPassword = ?, Salt = ? WHERE UserID = ?',
        [newHash, newSalt, req.user.id],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    req.session.message = 'Password changed successfully!';
    res.redirect('/client');
  } catch (err) {
    console.error('Error changing password:', err);
    req.session.message = 'An error occurred while changing password.';
    res.redirect('/client/change-password');
  }
});

module.exports = router;