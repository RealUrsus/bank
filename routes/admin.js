const express = require('express');

const checkRole = require('../middleware/checkRole.js');
const configService = require('../helpers/configService.js');
const ensureAuthenticated = require('../middleware/ensureAuth.js');

// Services
const userService = require('../services/user.service');
const transactionService = require('../services/transaction.service');
const loanService = require('../services/loan.service');
const gicService = require('../services/gic.service');
const agreementService = require('../services/agreement.service');

// Utils
const { validateId, validateRequiredFields } = require('../utils/validators');
const { TRANSACTION_CATEGORIES } = require('../services/constants');

const router = express.Router();

// Reducing redundancy
router.use(ensureAuthenticated, checkRole("ADMIN"));

// Route handler for the page
router.get('/', async (req, res, next) => {
    try {
      // Get counts and data for notifications
      const pendingTransactions = await transactionService.getAllPendingTransactions();
      const pendingTransactionsCount = pendingTransactions.length;
      const pendingLoans = await loanService.getPendingLoanRequests();
      const pendingLoansCount = pendingLoans.length;
      const maturingLoans = await loanService.getMaturingLoans(30);
      const maturingGICs = await gicService.getMaturingGICs(30);
      const maturingCount = maturingLoans.length + maturingGICs.length;

      // Get unique clients for each notification type
      const transactionClients = [...new Set(pendingTransactions.map(t =>
        `${t.Name} ${t.Surname} (#${t.UserID})`
      ))];
      const loanClients = [...new Set(pendingLoans.map(l =>
        `${l.Name} ${l.Surname} (#${l.UserID})`
      ))];

      res.render('admin', {
        user: req.user,
        pendingTransactionsCount,
        transactionClients,
        pendingLoansCount,
        loanClients,
        maturingCount,
        maturingLoans,
        maturingGICs
      });
    } catch (err) {
      next(err);
    }
  });

// Admin help page with process documentation
router.get('/help', async (req, res, next) => {
  try {
    res.render('admin-help', { user: req.user });
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const clientId = req.query.clientId ? validateId(req.query.clientId, 'clientId') : null;
    const options = await userService.getAllClients();
    const transactions = clientId ? await transactionService.getPendingTransactionsByUser(clientId) : null;

    res.render('admin-transactions', { user: req.user, options, clientId, transactions });
  } catch (err) {
    next(err);
  }
});

router.post('/transactions/update', async (req, res, next) => {
  try {
    const { id, clientId } = req.body;
    validateId(clientId, 'clientId');
    validateId(id, 'transaction id');

    await transactionService.approveTransaction(id);
    res.redirect(`/admin/transactions?clientId=${clientId}`);
  } catch (err) {
    next(err);
  }
});

router.post('/transactions/delete', async (req, res, next) => {
  try {
    const { id, clientId } = req.body;
    validateId(clientId, 'clientId');
    validateId(id, 'transaction id');

    await transactionService.deleteTransaction(id);
    res.redirect(`/admin/transactions?clientId=${clientId}`);
  } catch (err) {
    next(err);
  }
});

router.route('/loans/view')
  .get(async (req, res, next) => {
    try {
      const clientId = req.query.clientId ? validateId(req.query.clientId, 'clientId') : null;
      const options = await userService.getAllClients();
      const loans = clientId ? await loanService.getUserLoans(clientId) : null;

      res.render('admin-loans-view', { user: req.user, options, clientId, loans });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    try {
      const clientId = validateId(req.body.clientId, 'clientId');
      const options = await userService.getAllClients();
      const loans = await loanService.getUserLoans(clientId);

      res.render('admin-loans-view', { user: req.user, options, clientId, loans });
    } catch (err) {
      next(err);
    }
  });

router.route('/loans/add')
  .get(async (req, res, next) => {
    try {
      const users = await userService.getAllClients();
      res.render('admin-loans-add', { user: req.user, users });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    try {
      const { clientId, amount, interest, date, term, description, paymentFrequency } = req.body;

      validateId(clientId, 'clientId');
      validateRequiredFields({ amount, interest, date, term, description, paymentFrequency });

      await loanService.createLoanRequest({
        userId: clientId,
        amount,
        interestRate: interest,
        term,
        startDate: date,
        description,
        paymentFrequency
      });

      res.redirect('/admin/loans/view');
    } catch (err) {
      next(err);
    }
  });

router.route('/loans/edit/:loanId')
  .get(async (req, res, next) => {
    try {
      const loanId = validateId(req.params.loanId, 'loanId');
      const loan = await loanService.getLoan(loanId);

      if (!loan) {
        const error = new Error('Loan not found');
        error.status = 404;
        return next(error);
      }

      const users = await userService.getAllClients();
      const statuses = await configService.getConfig('Status');
      res.render('admin-loans-edit', { user: req.user, loan, users, statuses });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    try {
      const { loanId, clientId, amount, interest, date, term, paymentFrequency, description, status } = req.body;

      validateId(loanId, 'loanId');
      validateId(clientId, 'clientId');
      validateRequiredFields({ amount, interest, date, term, paymentFrequency, description, status });

      await loanService.updateLoan(loanId, {
        userId: clientId,
        interestRate: interest,
        principalAmount: amount,
        term,
        paymentFrequency,
        startDate: date,
        description,
        statusId: status
      });

      res.redirect(`/admin/loans/view?clientId=${clientId}`);
    } catch (err) {
      next(err);
    }
  });

// View pending loan requests
router.get('/loans/requests', async (req, res, next) => {
  try {
    const pendingLoans = await loanService.getPendingLoanRequests();
    res.render('admin-loans-requests', { user: req.user, pendingLoans });
  } catch (err) {
    next(err);
  }
});

// Approve loan request
router.post('/loans/approve', async (req, res, next) => {
  try {
    const loanId = validateId(req.body.loanId, 'loan id');
    await loanService.approveLoan(loanId);
    res.redirect('/admin/loans/requests');
  } catch (err) {
    next(err);
  }
});

// Deny loan request
router.post('/loans/deny', async (req, res, next) => {
  try {
    const loanId = validateId(req.body.loanId, 'loan id');
    await loanService.denyLoan(loanId);
    res.redirect('/admin/loans/requests');
  } catch (err) {
    next(err);
  }
});

router.post('/loans/update', async (req, res, next) => {
  try {
    const { id, clientId } = req.body;
    validateId(clientId, 'clientId');
    validateId(id, 'loan id');

    await loanService.approveLoan(id);
    res.redirect(`/admin/loans/view?clientId=${clientId}`);
  } catch (err) {
    next(err);
  }
});

router.post('/loans/delete', async (req, res, next) => {
  try {
    const { id, clientId } = req.body;
    validateId(clientId, 'clientId');
    validateId(id, 'loan id');

    await loanService.deleteLoan(id);
    res.redirect(`/admin/loans/view?clientId=${clientId}`);
  } catch (err) {
    next(err);
  }
});

// GIC Product Routes
router.get('/gics/view', async (req, res, next) => {
  try {
    const gicProducts = await gicService.getAllGICProducts();
    res.render('admin-gics-view', { user: req.user, gicProducts });
  } catch (err) {
    next(err);
  }
});

router.route('/gics/add')
  .get(async (req, res, next) => {
    try {
      res.render('admin-gics-add', { user: req.user });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    try {
      const { productName, interest, term, minimumAmount } = req.body;

      validateRequiredFields({ productName, interest, term });

      await gicService.createGICProduct({
        productName,
        interestRate: interest,
        term,
        minimumAmount: minimumAmount || 100
      });

      res.redirect('/admin/gics/view');
    } catch (err) {
      next(err);
    }
  });

router.route('/gics/edit/:productId')
  .get(async (req, res, next) => {
    try {
      const productId = validateId(req.params.productId, 'productId');
      const product = await gicService.getGICProduct(productId);

      if (!product) {
        const error = new Error('GIC Product not found');
        error.status = 404;
        return next(error);
      }

      res.render('admin-gics-edit', { user: req.user, product });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    try {
      const { productId, productName, interest, term, minimumAmount } = req.body;

      validateId(productId, 'productId');
      validateRequiredFields({ productName, interest, term, minimumAmount });

      await gicService.updateGICProduct(productId, {
        productName,
        interestRate: interest,
        term,
        minimumAmount
      });

      res.redirect('/admin/gics/view');
    } catch (err) {
      next(err);
    }
  });

router.post('/gics/delete', async (req, res, next) => {
  try {
    const id = validateId(req.body.id, 'product id');
    await gicService.deleteGICProduct(id);
    res.redirect('/admin/gics/view');
  } catch (err) {
    next(err);
  }
});

router.get('/agreements/view', async (req, res, next) => {
  try {
    const clients = await userService.getAllClients();
    const clientId = req.query.clientId ? validateId(req.query.clientId, 'clientId') : null;

    let agreements;
    let selectedClient = null;

    if (clientId) {
      // Get agreements for specific client
      agreements = await agreementService.getUserAgreements(clientId);
      selectedClient = clients.find(c => c.UserID === clientId);
    } else {
      // Get all agreements
      agreements = await agreementService.getAllAgreements();
    }

    res.render('admin-agreements-view', { user: req.user, agreements, clients, clientId, selectedClient });
  } catch (err) {
    next(err);
  }
});

router.route('/agreements/add')
  .get(async (req, res, next) => {
    try {
      const options = await userService.getAllClients();
      res.render('admin-agreements-add', { user: req.user, options });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    try {
      const { clientId, title, context } = req.body;
      validateId(clientId, 'clientId');

      await agreementService.createAgreement({
        userId: clientId,
        agreementName: title,
        agreementContent: context
      });

      res.redirect('/admin/agreements/view');
    } catch (err) {
      next(err);
    }
  });

router.route('/agreements/edit/:agreementId')
  .get(async (req, res, next) => {
    try {
      const agreementId = validateId(req.params.agreementId, 'agreementId');
      const agreement = await agreementService.getAgreement(agreementId);
      const statuses = await configService.getConfig('Status');

      res.render('admin-agreements-edit', { user: req.user, agreement, statuses });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    try {
      const { id, title, context, status } = req.body;
      validateId(id, 'AgreementID');

      await agreementService.updateAgreement(id, {
        agreementName: title,
        agreementContent: context,
        statusId: status
      });

      res.redirect('/admin/agreements/view');
    } catch (err) {
      next(err);
    }
  });

router.post('/agreements/delete', async (req, res, next) => {
  try {
    const id = validateId(req.body.id, 'agreement id');
    await agreementService.deleteAgreement(id);
    res.redirect('/admin/agreements/view');
  } catch (err) {
    next(err);
  }
});

// Client management routes
router.get('/clients', async (req, res, next) => {
  try {
    const clients = await userService.getAllClients();
    const message = req.session.message;
    const messageType = req.session.messageType || 'info';
    req.session.message = null; // Clear message after displaying
    req.session.messageType = null;
    res.render('admin-clients', { user: req.user, clients, message, messageType });
  } catch (err) {
    next(err);
  }
});

router.route('/clients/edit/:userId')
  .get(async (req, res, next) => {
    try {
      const userId = validateId(req.params.userId, 'userId');
      const clientData = await userService.getUser(userId);

      if (!clientData || clientData.RoleID !== 3) {
        const error = new Error('Client not found');
        error.status = 404;
        return next(error);
      }

      res.render('admin-clients-edit', { user: req.user, clientData });
    } catch (err) {
      next(err);
    }
  })
  .post(async (req, res, next) => {
    try {
      const { userId, username, name, surname } = req.body;

      validateId(userId, 'userId');
      validateRequiredFields({ username, name, surname });

      await userService.updateUser(userId, { username, name, surname });
      res.redirect('/admin/clients');
    } catch (err) {
      next(err);
    }
  });

// Admin change client password
router.post('/clients/change-password', async (req, res, next) => {
  try {
    const { userId, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!userId || !newPassword || !confirmPassword) {
      req.session.message = 'All fields are required.';
      req.session.messageType = 'danger';
      return res.redirect('/admin/clients');
    }

    validateId(userId, 'userId');

    if (!userService.passwordsMatch(newPassword, confirmPassword)) {
      req.session.message = 'Passwords do not match.';
      req.session.messageType = 'danger';
      return res.redirect('/admin/clients');
    }

    // Change password using admin service
    const result = await userService.adminChangePassword(userId, newPassword);

    req.session.message = result.message;
    req.session.messageType = result.success ? 'success' : 'danger';
    res.redirect('/admin/clients');
  } catch (err) {
    console.error('Error changing client password:', err);
    req.session.message = 'An error occurred while changing password.';
    req.session.messageType = 'danger';
    res.redirect('/admin/clients');
  }
});

// Admin reports route with client selection
router.get('/reports', async (req, res, next) => {
  try {
    const clients = await userService.getAllClients();
    const clientId = req.query.clientId ? validateId(req.query.clientId, 'clientId') : null;

    let reportData = null;
    let selectedClient = null;

    if (clientId) {
      // Get client's chequing account
      const accountService = require('../services/account.service');
      const getAccountID = require('../middleware/getAccountID.js');
      const { formatDate } = require('../utils/formatters');

      const accountID = await getAccountID(clientId, "Chequing");

      // Extract filters from query parameters
      const { category, transactionType, startDate, endDate, timeframe } = req.query;

      // Handle predefined timeframes
      let filters = { category, transactionType };

      if (timeframe === 'all') {
        // No date filters for all time
        filters.startDate = null;
        filters.endDate = null;
      } else if (timeframe === 'custom' && startDate && endDate) {
        // Custom date range
        filters.startDate = startDate;
        filters.endDate = endDate;
      } else if (timeframe && timeframe.includes('-')) {
        // Month format: YYYY-MM
        const [year, month] = timeframe.split('-');
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);
        filters.startDate = formatDate(startOfMonth);
        filters.endDate = formatDate(endOfMonth);
      }

      // Generate report
      reportData = await transactionService.generateReport(accountID, filters);

      // Get selected client info
      selectedClient = clients.find(c => c.UserID === clientId);
    }

    res.render('admin-reports', {
      user: req.user,
      clients,
      selectedClient,
      reportData,
      filters: req.query,
      categories: TRANSACTION_CATEGORIES
    });
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
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.session.message = 'All fields are required.';
      return res.redirect('/admin/change-password');
    }

    if (!userService.passwordsMatch(newPassword, confirmPassword)) {
      req.session.message = 'New passwords do not match.';
      return res.redirect('/admin/change-password');
    }

    // Change password using service
    const result = await userService.changePassword(req.user.id, currentPassword, newPassword);

    req.session.message = result.message;

    if (result.success) {
      res.redirect('/admin');
    } else {
      res.redirect('/admin/change-password');
    }
  } catch (err) {
    console.error('Error changing password:', err);
    req.session.message = 'An error occurred while changing password.';
    res.redirect('/admin/change-password');
  }
});

module.exports = router;