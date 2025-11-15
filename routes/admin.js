const express = require('express');
const asyncHandler = require('../middleware/asyncHandler.js');

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
const { validateId, validateRequiredFields, sanitizeHtml } = require('../utils/validators');
const { TRANSACTION_CATEGORIES, ROLES } = require('../services/constants');
const { buildReportFilters } = require('../utils/reportHelpers');
const { formatDate } = require('../utils/formatters');

const router = express.Router();

// Reducing redundancy
router.use(ensureAuthenticated, checkRole("ADMIN"));

// Route handler for the page
router.get('/', asyncHandler(async (req, res) => {
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
}));

// Admin help page with process documentation
router.get('/help', asyncHandler(async (req, res) => {
  res.render('admin-help', { user: req.user });
}));

router.get('/transactions', asyncHandler(async (req, res) => {
  const clientId = req.query.clientId ? validateId(req.query.clientId, 'clientId') : null;
  const options = await userService.getAllClients();
  const transactions = clientId ? await transactionService.getPendingTransactionsByUser(clientId) : null;

  res.render('admin-transactions', { user: req.user, options, clientId, transactions });
}));

router.post('/transactions/update', asyncHandler(async (req, res) => {
  const { id, clientId } = req.body;
  validateId(clientId, 'clientId');
  validateId(id, 'transaction id');

  await transactionService.approveTransaction(id);
  res.redirect(`/admin/transactions?clientId=${clientId}`);
}));

router.post('/transactions/delete', asyncHandler(async (req, res) => {
  const { id, clientId } = req.body;
  validateId(clientId, 'clientId');
  validateId(id, 'transaction id');

  await transactionService.deleteTransaction(id);
  res.redirect(`/admin/transactions?clientId=${clientId}`);
}));

router.route('/loans/view')
  .get(asyncHandler(async (req, res) => {
    const clientId = req.query.clientId ? validateId(req.query.clientId, 'clientId') : null;
    const options = await userService.getAllClients();
    const loans = clientId ? await loanService.getUserLoans(clientId) : null;

    res.render('admin-loans-view', { user: req.user, options, clientId, loans });
  }))
  .post(asyncHandler(async (req, res) => {
    const clientId = validateId(req.body.clientId, 'clientId');
    const options = await userService.getAllClients();
    const loans = await loanService.getUserLoans(clientId);

    res.render('admin-loans-view', { user: req.user, options, clientId, loans });
  }));

router.route('/loans/add')
  .get(asyncHandler(async (req, res) => {
    const users = await userService.getAllClients();
    res.render('admin-loans-add', { user: req.user, users });
  }))
  .post(asyncHandler(async (req, res) => {
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
      paymentFrequencyId: parseInt(paymentFrequency)
    });

    res.redirect('/admin/loans/view');
  }));

router.route('/loans/edit/:loanId')
  .get(asyncHandler(async (req, res) => {
    const loanId = validateId(req.params.loanId, 'loanId');
    const loan = await loanService.getLoan(loanId);

    if (!loan) {
      const error = new Error('Loan not found');
      error.status = 404;
      throw error;
    }

    const users = await userService.getAllClients();
    const statuses = await configService.getConfig('Status');
    res.render('admin-loans-edit', { user: req.user, loan, users, statuses });
  }))
  .post(asyncHandler(async (req, res) => {
    const { loanId, clientId, amount, interest, date, term, paymentFrequency, description, status } = req.body;

    validateId(loanId, 'loanId');
    validateId(clientId, 'clientId');
    validateRequiredFields({ amount, interest, date, term, paymentFrequency, description, status });

    await loanService.updateLoan(loanId, {
      userId: clientId,
      interestRate: interest,
      principalAmount: amount,
      term,
      paymentFrequencyId: parseInt(paymentFrequency),
      startDate: date,
      description,
      statusId: status
    });

    res.redirect(`/admin/loans/view?clientId=${clientId}`);
  }));

// View pending loan requests
router.get('/loans/requests', asyncHandler(async (req, res) => {
  const pendingLoans = await loanService.getPendingLoanRequests();
  res.render('admin-loans-requests', { user: req.user, pendingLoans });
}));

// Approve loan request
router.post('/loans/approve', asyncHandler(async (req, res) => {
  const loanId = validateId(req.body.loanId, 'loan id');
  await loanService.approveLoan(loanId);
  res.redirect('/admin/loans/requests');
}));

// Deny loan request
router.post('/loans/deny', asyncHandler(async (req, res) => {
  const loanId = validateId(req.body.loanId, 'loan id');
  await loanService.denyLoan(loanId);
  res.redirect('/admin/loans/requests');
}));

router.post('/loans/update', asyncHandler(async (req, res) => {
  const { id, clientId } = req.body;
  validateId(clientId, 'clientId');
  validateId(id, 'loan id');

  await loanService.approveLoan(id);
  res.redirect(`/admin/loans/view?clientId=${clientId}`);
}));

router.post('/loans/delete', asyncHandler(async (req, res) => {
  const { id, clientId } = req.body;
  validateId(clientId, 'clientId');
  validateId(id, 'loan id');

  await loanService.deleteLoan(id);
  res.redirect(`/admin/loans/view?clientId=${clientId}`);
}));

// GIC Product Routes
router.get('/gics/view', asyncHandler(async (req, res) => {
  const gicProducts = await gicService.getAllGICProducts();
  res.render('admin-gics-view', { user: req.user, gicProducts });
}));

router.route('/gics/add')
  .get(asyncHandler(async (req, res) => {
    res.render('admin-gics-add', { user: req.user });
  }))
  .post(asyncHandler(async (req, res) => {
    const { productName, interest, term, minimumAmount } = req.body;

    validateRequiredFields({ productName, interest, term });

    await gicService.createGICProduct({
      productName,
      interestRate: interest,
      term,
      minimumAmount: minimumAmount || 100
    });

    res.redirect('/admin/gics/view');
  }));

router.route('/gics/edit/:productId')
  .get(asyncHandler(async (req, res) => {
    const productId = validateId(req.params.productId, 'productId');
    const product = await gicService.getGICProduct(productId);

    if (!product) {
      const error = new Error('GIC Product not found');
      error.status = 404;
      throw error;
    }

    res.render('admin-gics-edit', { user: req.user, product });
  }))
  .post(asyncHandler(async (req, res) => {
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
  }));

router.post('/gics/delete', asyncHandler(async (req, res) => {
  const id = validateId(req.body.id, 'product id');
  await gicService.deleteGICProduct(id);
  res.redirect('/admin/gics/view');
}));

router.get('/agreements/view', asyncHandler(async (req, res) => {
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
}));

router.route('/agreements/add')
  .get(asyncHandler(async (req, res) => {
    const options = await userService.getAllClients();
    res.render('admin-agreements-add', { user: req.user, options });
  }))
  .post(asyncHandler(async (req, res) => {
    const { clientId, title, context } = req.body;
    validateId(clientId, 'clientId');

    await agreementService.createAgreement({
      userId: clientId,
      agreementName: sanitizeHtml(title),
      agreementContent: sanitizeHtml(context)
    });

    res.redirect('/admin/agreements/view');
  }));

router.route('/agreements/edit/:agreementId')
  .get(asyncHandler(async (req, res) => {
    const agreementId = validateId(req.params.agreementId, 'agreementId');
    const agreement = await agreementService.getAgreement(agreementId);
    const statuses = await configService.getConfig('Status');

    res.render('admin-agreements-edit', { user: req.user, agreement, statuses });
  }))
  .post(asyncHandler(async (req, res) => {
    const { id, title, context, status } = req.body;
    validateId(id, 'AgreementID');

    await agreementService.updateAgreement(id, {
      agreementName: sanitizeHtml(title),
      agreementContent: sanitizeHtml(context),
      statusId: status
    });

    res.redirect('/admin/agreements/view');
  }));

router.post('/agreements/delete', asyncHandler(async (req, res) => {
  const id = validateId(req.body.id, 'agreement id');
  await agreementService.deleteAgreement(id);
  res.redirect('/admin/agreements/view');
}));

// Client management routes
router.get('/clients', asyncHandler(async (req, res) => {
  const clients = await userService.getAllClients();
  const message = req.session.message;
  const messageType = req.session.messageType || 'info';
  req.session.message = null; // Clear message after displaying
  req.session.messageType = null;
  res.render('admin-clients', { user: req.user, clients, message, messageType });
}));

router.route('/clients/edit/:userId')
  .get(asyncHandler(async (req, res) => {
    const userId = validateId(req.params.userId, 'userId');
    const clientData = await userService.getUser(userId);

    if (!clientData || clientData.RoleID !== ROLES.CLIENT) {
      const error = new Error('Client not found');
      error.status = 404;
      throw error;
    }

    res.render('admin-clients-edit', { user: req.user, clientData });
  }))
  .post(asyncHandler(async (req, res) => {
    const { userId, username, name, surname } = req.body;

    validateId(userId, 'userId');
    validateRequiredFields({ username, name, surname });

    await userService.updateUser(userId, { username, name, surname });
    res.redirect('/admin/clients');
  }));

// Admin change client password
router.post('/clients/change-password', asyncHandler(async (req, res) => {
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
}));

// Admin reports route with client selection
router.get('/reports', asyncHandler(async (req, res) => {
  const clients = await userService.getAllClients();
  const clientId = req.query.clientId ? validateId(req.query.clientId, 'clientId') : null;

  let reportData = null;
  let selectedClient = null;

  if (clientId) {
    // Get client's chequing account
    const accountService = require('../services/account.service');
    const getAccountID = require('../middleware/getAccountID.js');

    const accountID = await getAccountID(clientId, "Chequing");

    // Build filters from query parameters
    const filters = buildReportFilters(req.query);

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
}));

// GET /admin/change-password
router.get('/change-password', (req, res) => {
  res.render('change-password', { user: req.user, userRole: 'admin' });
});

// POST /admin/change-password
router.post('/change-password', asyncHandler(async (req, res) => {
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
}));

module.exports = router;