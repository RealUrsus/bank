const express = require('express');

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

async function fetchLoans() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT a.*, u.Name, u.Surname
              FROM Accounts a
              INNER JOIN Users u ON a.UserID = u.UserID
              WHERE a.AccountTypeID = 2 AND a.StatusID = 1;`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
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

router.get('/loans', async (req, res, next) => {
    try { 
      const loans = await fetchLoans();
      res.render('admin-loans', { user: req.user, loans });
    } catch (err) {
      next(err);
    }
});

router.post('/loans/update', async (req, res, next) => {
  const { id  } = req.body;
  if (!Number.isInteger(parseInt(id, 10))) return next(validationError('Invalid option id'));

  try {
    await new Promise((resolve, reject) => {
      db.run('UPDATE Accounts SET StatusID = 2 WHERE AccountID = ?', [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    res.redirect(`/admin/loans`);
  } catch (err) {
    next(err);
  }
});

router.post('/loans/delete', async (req, res, next) => {
  const { id } = req.body;
  if (!Number.isInteger(parseInt(id, 10))) return next(validationError('Invalid option id'));

  try {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM Accounts WHERE AccountID = ?', [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    res.redirect(`/admin/loans`);
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

  router.route('/agreements/edit/:agreementId(\\d+)')
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

module.exports = router;