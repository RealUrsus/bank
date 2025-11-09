const express = require('express');
const crypto = require('crypto');

const checkRole = require('../middleware/checkRole.js');
const configService = require('../helpers/configService.js');
const ensureAuthenticated = require('../middleware/ensureAuth.js');
const db = require('../utils/db.js');

const router = express.Router();

// Format a date as 'YYYY-MM-DD'
const formatDate = (date) => date.toISOString().split('T')[0];

// Helper function to fetch users
async function fetchUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT UserID, Name, Surname FROM Users WHERE RoleID = 3', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function fetchAgreement(agreemetId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT u.UserID, u.Name, u.Surname, a.AgreementID, a.AgreementName, a.AgreementContent, s.StatusName \
      FROM Users u \
        INNER JOIN Agreements a ON u.UserID = a.UserID \
        INNER JOIN Status s ON a.StatusID = s.StatusID \
      WHERE a.AgreementID = ?', [agreemetId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function fetchAgreements() {
  return new Promise((resolve, reject) => {
    db.all('SELECT u.Name, u.Surname, a.AgreementID, a.AgreementName, s.StatusName \
      FROM Users u \
        INNER JOIN Agreements a ON u.UserID = a.UserID \
        INNER JOIN Status s ON a.StatusID = s.StatusID', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Helper function to fetch transactions
async function fetchTransactions(clientId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT t.* FROM Transactions t INNER JOIN Accounts a ON t.AccountID = a.AccountID WHERE a.UserID = ? AND a.AccountTypeID = 1 AND t.StatusID = 1;', [clientId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function fetchLoans(clientId) {
  return new Promise((resolve, reject) => {
    if (clientId) {
      db.all(`SELECT a.*, u.Name, u.Surname
                FROM Accounts a
                INNER JOIN Users u ON a.UserID = u.UserID
                WHERE a.AccountTypeID = 2 AND a.UserID = ?;`, [clientId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    } else {
      resolve([]);
    }
  });
}

async function fetchLoan(loanId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT a.*, u.Name, u.Surname, u.UserID
              FROM Accounts a
              INNER JOIN Users u ON a.UserID = u.UserID
              WHERE a.AccountID = ? AND a.AccountTypeID = 2;`, [loanId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function fetchGICs(clientId) {
  return new Promise((resolve, reject) => {
    if (clientId) {
      db.all(`SELECT a.*, u.Name, u.Surname
                FROM Accounts a
                INNER JOIN Users u ON a.UserID = u.UserID
                WHERE a.AccountTypeID = 4 AND a.UserID = ?;`, [clientId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    } else {
      resolve([]);
    }
  });
}

async function fetchGIC(gicId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT a.*, u.Name, u.Surname, u.UserID
              FROM Accounts a
              INNER JOIN Users u ON a.UserID = u.UserID
              WHERE a.AccountID = ? AND a.AccountTypeID = 4;`, [gicId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

// Reducing redundancy
router.use(ensureAuthenticated, checkRole("ADMIN"));

// Route handler for the page
router.get('/', async (req, res, next) => {
    try {
      res.render('admin', { user: req.user });
    } catch (err) {
      next(err);
    }
  });

router.route('/transactions')
  .get(async (req, res, next) => {    
    const clientId = req.query.clientId ? parseInt(req.query.clientId, 10) : null;

    try {      
      const options = await fetchUsers();      
      const transactions = clientId ? await fetchTransactions(clientId) : null;

      res.render('admin-transactions', { user: req.user, options, clientId, transactions });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    const clientId = parseInt(req.body.clientId, 10);

    try {
      const options = await fetchUsers();
      const transactions = clientId ? await fetchTransactions(clientId) : [];
      res.render('admin-transactions', { user: req.user, options, clientId, transactions });
    } catch (err) {
      next(err);
    }
  });  

router.post('/transactions/update', async (req, res, next) => {
  const { id , clientId } = req.body;
  if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));
  if (!Number.isInteger(parseInt(id, 10))) return next(validationError('Invalid option id'));

  try {
    await new Promise((resolve, reject) => {
      db.run('UPDATE Transactions SET StatusID = 2 WHERE TransactionID = ?', [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    res.redirect(`/admin/transactions?clientId=${clientId}`);
  } catch (err) {
    next(err);
  }
});

router.post('/transactions/delete', async (req, res, next) => {
  const { id , clientId } = req.body;
  if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));
  if (!Number.isInteger(parseInt(id, 10))) return next(validationError('Invalid option id'));

  try {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM Transactions WHERE TransactionID = ?', [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    res.redirect(`/admin/transactions?clientId=${clientId}`);
  } catch (err) {
    next(err);
  }
});

router.route('/loans/view')
  .get(async (req, res, next) => {
    const clientId = req.query.clientId ? parseInt(req.query.clientId, 10) : null;

    try {
      const options = await fetchUsers();
      const loans = clientId ? await fetchLoans(clientId) : null;

      res.render('admin-loans-view', { user: req.user, options, clientId, loans });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    const clientId = parseInt(req.body.clientId, 10);

    try {
      const options = await fetchUsers();
      const loans = clientId ? await fetchLoans(clientId) : [];
      res.render('admin-loans-view', { user: req.user, options, clientId, loans });
    } catch (err) {
      next(err);
    }
  });

router.route('/loans/add')
  .get(async (req, res, next) => {
    try {
      const users = await fetchUsers();
      res.render('admin-loans-add', { user: req.user, users });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    const { clientId, amount, interest, date, term, description } = req.body;

    if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));
    if (!amount || !interest || !date || !term || !description) {
      return next(validationError('All fields are required'));
    }

    try {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO Accounts (UserID, AccountTypeID, InterestRate, PrincipalAmount, Term, StartDate, StatusID, Description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [clientId, 2, interest, amount, term, date, 1, description],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
      res.redirect('/admin/loans/view');
    } catch (err) {
      next(err);
    }
  });

router.route('/loans/edit/:loanId')
  .get(async (req, res, next) => {
    try {
      const loanId = parseInt(req.params.loanId, 10);

      if (!Number.isInteger(loanId) || loanId <= 0) {
        return next(validationError('Invalid loanId'));
      }

      const loan = await fetchLoan(loanId);
      if (!loan) {
        return next(validationError('Loan not found'));
      }

      const users = await fetchUsers();
      const statuses = await configService.getConfig('Status');
      res.render('admin-loans-edit', { user: req.user, loan, users, statuses });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    const { loanId, clientId, amount, interest, date, term, description, status } = req.body;

    if (!Number.isInteger(parseInt(loanId, 10))) return next(validationError('Invalid loanId'));
    if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));
    if (!amount || !interest || !date || !term || !description || !status) {
      return next(validationError('All fields are required'));
    }

    try {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE Accounts SET UserID = ?, InterestRate = ?, PrincipalAmount = ?, Term = ?, StartDate = ?, Description = ?, StatusID = ? WHERE AccountID = ? AND AccountTypeID = 2',
          [clientId, interest, amount, term, date, description, status, loanId],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
      res.redirect(`/admin/loans/view?clientId=${clientId}`);
    } catch (err) {
      next(err);
    }
  });

router.post('/loans/update', async (req, res, next) => {
  const { id, clientId } = req.body;
  if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));
  if (!Number.isInteger(parseInt(id, 10))) return next(validationError('Invalid option id'));

  try {
    await new Promise((resolve, reject) => {
      db.run('UPDATE Accounts SET StatusID = 2 WHERE AccountID = ?', [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    res.redirect(`/admin/loans/view?clientId=${clientId}`);
  } catch (err) {
    next(err);
  }
});

router.post('/loans/delete', async (req, res, next) => {
  const { id, clientId } = req.body;
  if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));
  if (!Number.isInteger(parseInt(id, 10))) return next(validationError('Invalid option id'));

  try {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM Accounts WHERE AccountID = ?', [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    res.redirect(`/admin/loans/view?clientId=${clientId}`);
  } catch (err) {
    next(err);
  }
});

// GIC Routes
router.route('/gics/view')
  .get(async (req, res, next) => {
    const clientId = req.query.clientId ? parseInt(req.query.clientId, 10) : null;

    try {
      const options = await fetchUsers();
      const gics = clientId ? await fetchGICs(clientId) : null;

      res.render('admin-gics-view', { user: req.user, options, clientId, gics });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    const clientId = parseInt(req.body.clientId, 10);

    try {
      const options = await fetchUsers();
      const gics = clientId ? await fetchGICs(clientId) : [];
      res.render('admin-gics-view', { user: req.user, options, clientId, gics });
    } catch (err) {
      next(err);
    }
  });

router.route('/gics/add')
  .get(async (req, res, next) => {
    try {
      const users = await fetchUsers();
      res.render('admin-gics-add', { user: req.user, users });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    const { clientId, amount, interest, date, term } = req.body;

    if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));
    if (!amount || !interest || !date || !term) {
      return next(validationError('All fields are required'));
    }

    try {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO Accounts (UserID, AccountTypeID, InterestRate, PrincipalAmount, Term, StartDate, StatusID, Balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [clientId, 4, interest, amount, term, date, 1, amount],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
      res.redirect('/admin/gics/view');
    } catch (err) {
      next(err);
    }
  });

router.route('/gics/edit/:gicId')
  .get(async (req, res, next) => {
    try {
      const gicId = parseInt(req.params.gicId, 10);

      if (!Number.isInteger(gicId) || gicId <= 0) {
        return next(validationError('Invalid gicId'));
      }

      const gic = await fetchGIC(gicId);
      if (!gic) {
        return next(validationError('GIC not found'));
      }

      const users = await fetchUsers();
      const statuses = await configService.getConfig('Status');
      res.render('admin-gics-edit', { user: req.user, gic, users, statuses });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    const { gicId, clientId, amount, interest, date, term, status } = req.body;

    if (!Number.isInteger(parseInt(gicId, 10))) return next(validationError('Invalid gicId'));
    if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));
    if (!amount || !interest || !date || !term || !status) {
      return next(validationError('All fields are required'));
    }

    try {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE Accounts SET UserID = ?, InterestRate = ?, PrincipalAmount = ?, Term = ?, StartDate = ?, StatusID = ?, Balance = ? WHERE AccountID = ? AND AccountTypeID = 4',
          [clientId, interest, amount, term, date, status, amount, gicId],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
      res.redirect(`/admin/gics/view?clientId=${clientId}`);
    } catch (err) {
      next(err);
    }
  });

router.post('/gics/update', async (req, res, next) => {
  const { id, clientId } = req.body;
  if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));
  if (!Number.isInteger(parseInt(id, 10))) return next(validationError('Invalid option id'));

  try {
    await new Promise((resolve, reject) => {
      db.run('UPDATE Accounts SET StatusID = 2 WHERE AccountID = ?', [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    res.redirect(`/admin/gics/view?clientId=${clientId}`);
  } catch (err) {
    next(err);
  }
});

router.post('/gics/delete', async (req, res, next) => {
  const { id, clientId } = req.body;
  if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));
  if (!Number.isInteger(parseInt(id, 10))) return next(validationError('Invalid option id'));

  try {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM Accounts WHERE AccountID = ?', [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    res.redirect(`/admin/gics/view?clientId=${clientId}`);
  } catch (err) {
    next(err);
  }
});

router.get('/agreements/view', async (req, res, next) => {

  try {
    const agreements = await fetchAgreements()

    res.render('admin-agreements-view', { user: req.user, agreements });
  } catch (err) {
    next(err);
  }
});

router.route('/agreements/add')
  .get(async (req, res, next) => {    
    try {      
      const options = await fetchUsers();      
      res.render('admin-agreements-add', { user: req.user, options });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    const { clientId, title, context } = req.body;
    if (!Number.isInteger(parseInt(clientId, 10))) return next(validationError('Invalid clientId'));

    try {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO Agreements (UserID, AgreementName, AgreementContent, StatusID) VALUES (?, ?, ?, ?)', [clientId, title, context, 4], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      res.redirect('/admin/agreements/view');
    } catch (err) {
      next(err);
    }
  });  

  router.route('/agreements/edit/:agreementId')
  .get(async (req, res, next) => {

    try {
      const agreementId = req.params.agreementId;      
      const agreement = await fetchAgreement(agreementId); 
      const statuses = await configService.getConfig('Status');

      res.render('admin-agreements-edit', { user: req.user, agreement, statuses });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    const { id, title, context, status } = req.body;
    if (!Number.isInteger(parseInt(id, 10))) return next(validationError('Invalid AgreementID'));

    try {
      await new Promise((resolve, reject) => {


        db.run('UPDATE Agreements SET AgreementName = ?, AgreementContent = ?, StatusID = ? WHERE AgreementID = ?', [title, context, status, id], (err) => {
          if (err) return reject(err);
          resolve();
        });

      });
      res.redirect(`/admin/agreements/view`);
    } catch (err) {
      next(err);
    }
  });

// GET /admin/change-password
router.get('/change-password', (req, res) => {
  res.render('change-password', { user: req.user, userRole: 'admin' });
});

// POST /admin/change-password
router.post('/change-password', async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Validate input
  if (!currentPassword || !newPassword || !confirmPassword) {
    req.session.message = 'All fields are required.';
    return res.redirect('/admin/change-password');
  }

  if (newPassword !== confirmPassword) {
    req.session.message = 'New passwords do not match.';
    return res.redirect('/admin/change-password');
  }

  if (newPassword.length < 8) {
    req.session.message = 'New password must be at least 8 characters long.';
    return res.redirect('/admin/change-password');
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
      return res.redirect('/admin/change-password');
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
    res.redirect('/admin');
  } catch (err) {
    console.error('Error changing password:', err);
    req.session.message = 'An error occurred while changing password.';
    res.redirect('/admin/change-password');
  }
});

module.exports = router;