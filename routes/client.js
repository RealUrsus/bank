const express = require('express');
const checkRole = require('../middleware/checkRole.js');
const configService = require('../helpers/configService.js');
const ensureAuthenticated = require('../middleware/ensureAuth.js');
const getAccountID = require('../middleware/getAccountID.js');

// Services
const accountService = require('../services/account.service');
const transactionService = require('../services/transaction.service');
const loanService = require('../services/loan.service');
const gicService = require('../services/gic.service');
const agreementService = require('../services/agreement.service');
const userService = require('../services/user.service');

// Utils
const { formatDate } = require('../utils/formatters');
const { validateId, validateDateNotFuture, validateRequiredFields, validateAmount, validatePeriod } = require('../utils/validators');
const { DATE_CONFIG } = require('../services/constants');

const router = express.Router();

// Middleware to load config for all routes handled by this router
router.use(async (req, res, next) => {
  try {
      const roles = await configService.getConfig('Roles');
      req.roles = roles;
      next();
  } catch (error) {
      next(error);
  }
});

// Middleware to fetch transactions by period
async function getTransactions(req, res, next) {
  try {
    const period = validatePeriod(req.params.period || DATE_CONFIG.DEFAULT_TRANSACTION_PERIOD_DAYS, DATE_CONFIG.MAX_TRANSACTION_PERIOD_DAYS);
    const transactions = await transactionService.getTransactionsByPeriod(req.user.account, period);
    res.locals.transactions = transactions;
    next();
  } catch (err) {
    next(err);
  }
}

// Middleware to fetch user loans
async function fetchLoans(req, res, next) {
  try {
    const loans = await loanService.getUserLoans(req.user.id, true);
    res.locals.loans = loans;
    next();
  } catch (err) {
    next(err);
  }
}

// Reducing redundancy
router.use(ensureAuthenticated, checkRole("CLIENT"));

// Route handlers
router.get('/', async (req, res) => {
  try {
    const accountID = await getAccountID(req.user.id, "Chequing");
    req.user["account"] = accountID;

    // Get financial summary data
    // Savings (Chequing account balance)
    const savingsBalance = await accountService.getApprovedBalance(accountID);

    // Loans summary
    const loans = await loanService.getUserLoans(req.user.id, true);
    let totalLoaned = 0;
    let totalOwed = 0;
    loans.forEach(loan => {
      totalLoaned += loan.PrincipalAmount;
      const balance = loan.Balance || 0;
      const remaining = loan.PrincipalAmount - balance;
      if (remaining > 0) {
        totalOwed += remaining;
      }
    });

    // Investments (GICs) summary
    const gics = await gicService.getUserGICs(req.user.id);
    let totalInvested = 0;
    let currentInvestmentValue = 0;
    for (const gic of gics) {
      if (gic.StatusID === 4) { // Active status
        totalInvested += gic.PrincipalAmount;
        const balance = await accountService.getBalance(gic.AccountID);
        currentInvestmentValue += balance;
      }
    }

    res.render('client', {
      user: req.user,
      savingsBalance,
      totalLoaned,
      totalOwed,
      loansCount: loans.length,
      totalInvested,
      currentInvestmentValue,
      gicsCount: gics.filter(g => g.StatusID === 4).length
    });
  } catch (error) {
    console.error('Error in client dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Default transactions route (30 days)
router.get('/transactions', getTransactions, async (req, res) => {
  res.locals.filter = null;
  const balance = await accountService.getBalance(req.user.account);
  const approved_balance = await accountService.getApprovedBalance(req.user.account);
  res.render('client-transactions', { user: req.user, balance, approved_balance });
});

// Transactions route with period parameter
router.get('/transactions/:period', getTransactions, async (req, res) => {
  res.locals.filter = null;
  const balance = await accountService.getBalance(req.user.account);
  const approved_balance = await accountService.getApprovedBalance(req.user.account);
  res.render('client-transactions', { user: req.user, balance, approved_balance });
});

router.post('/transactions/add', async (req, res, next) => {
  try {
    const { amount, type, date, description } = req.body;

    validateRequiredFields({ amount, type, date, description });
    validateDateNotFuture(date);
    const validAmount = validateAmount(amount);

    await transactionService.createTransaction({
      accountId: req.user.account,
      transactionTypeId: type,
      amount: validAmount,
      date,
      description
    });

    res.redirect('/client/transactions');
  } catch (err) {
    next(err);
  }
});

router.get('/loan/add', (req, res) => {
  res.locals.filter = null;
  res.render('client-loan-add', { user: req.user });
});

router.post('/loan/add', async (req, res, next) => {
  try {
    const { amount, interest, date, term, description, paymentFrequency } = req.body;

    validateRequiredFields({ amount, interest, date, term, description, paymentFrequency });

    const loanId = await loanService.createLoanRequest({
      userId: req.user.id,
      amount,
      interestRate: interest,
      term,
      startDate: date,
      description,
      paymentFrequency
    });

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
    const loanId = validateId(req.params.loanId, 'loanId');

    const account = await accountService.getAccount(loanId);
    const transactions = await transactionService.getTransactions(loanId);
    const balance = await accountService.getBalance(loanId);

    res.render('client-loan-view', { user: req.user, transactions, balance, account });
  } catch (err) {
      next(err);
  }
});

router.get('/loan/:confirmationId', async (req, res, next) => {
  try {
    const confirmationId = validateId(req.params.confirmationId, 'confirmationId');
    res.render('client-loan-confirmation', { user: req.user, confirmationId });
  } catch (err) {
      next(err);
  }
});

// GIC Routes
router.get('/gic/add', async (req, res, next) => {
  try {
    const gicProducts = await gicService.getAllGICProducts();
    const approved_balance = await accountService.getApprovedBalance(req.user.account);
    res.render('client-gic-add', { user: req.user, gicProducts, approved_balance });
  } catch (err) {
    next(err);
  }
});

router.post('/gic/purchase/:productId', async (req, res, next) => {
  try {
    const productId = validateId(req.params.productId, 'productId');
    const { amount } = req.body;
    const investmentAmount = validateAmount(amount);

    const gicAccountId = await gicService.purchaseGIC({
      userId: req.user.id,
      chequingAccountId: req.user.account,
      productId,
      amount: investmentAmount
    });

    res.redirect(`/client/gic/${gicAccountId}`);
  } catch (err) {
    if (err.status === 400) {
      req.session.message = err.message;
      return res.redirect('/client/gic/add');
    }
    next(err);
  }
});

router.get('/gic/view', async (req, res, next) => {
  try {
    const gics = await gicService.getUserGICs(req.user.id);
    res.render('client-gics-view', { user: req.user, gics });
  } catch (err) {
    next(err);
  }
});

router.get('/gic/view/:gicId', async (req, res, next) => {
  try {
    const gicId = validateId(req.params.gicId, 'gicId');

    const account = await accountService.getAccount(gicId);
    const transactions = await transactionService.getTransactions(gicId);
    const balance = await accountService.getBalance(gicId);

    res.render('client-gic-view', { user: req.user, transactions, balance, account });
  } catch (err) {
    next(err);
  }
});

router.get('/gic/:confirmationId', async (req, res, next) => {
  try {
    const confirmationId = validateId(req.params.confirmationId, 'confirmationId');
    const account = await accountService.getAccount(confirmationId);
    res.render('client-gic-confirmation', { user: req.user, gic: account });
  } catch (err) {
    next(err);
  }
});

router.get('/transfer', fetchLoans, async (req, res, next) => {
  try {
    const approved_balance = await accountService.getApprovedBalance(req.user.account);
    res.render('client-transfer', {
      user: req.user,
      account: req.user.account,
      approved_balance
     });
  } catch (err) {
      next(err);
  }
});

router.post('/transfer', async (req, res, next) => {
  try {
    const { source, destination, amount } = req.body;

    validateRequiredFields({ source, destination, amount });
    const validAmount = validateAmount(amount);

    // Verification
    const srcBalance = await accountService.getBalance(source);
    const dstBalance = await accountService.getBalance(destination);
    const srcAccount = await accountService.getAccount(source);
    const dstAccount = await accountService.getAccount(destination);

    if (srcBalance <= 0 || srcBalance < validAmount) {
      req.session.message = 'Insufficient funds for transfer';
      return res.redirect('/client/transfer');
    }

    if ((dstAccount.PrincipalAmount - dstBalance - validAmount) < 0) {
      req.session.message = 'Transfer amount exceeds loan principal';
      return res.redirect('/client/transfer');
    }

    // Create descriptive messages using service method
    const srcAccountType = accountService.getAccountTypeName(srcAccount.AccountTypeID);
    const dstAccountType = accountService.getAccountTypeName(dstAccount.AccountTypeID);

    const destinationDesc = `Internal Transaction from ${srcAccountType} #${source}`;
    const sourceDesc = `Internal Transaction to ${dstAccountType} #${destination}`;

    // Execute transfer
    await transactionService.executeTransfer({
      sourceAccountId: source,
      destinationAccountId: destination,
      amount: validAmount,
      sourceDescription: sourceDesc,
      destinationDescription: destinationDesc
    });

    res.redirect('/client/transactions');
  } catch (err) {
    next(err);
  }
});


router.get('/agreements', async (req, res, next) => {
  try {
    const agreements = await agreementService.getAllAgreements();
    res.render('client-agreements', { user: req.user, agreements });
  } catch (err) {
      next(err);
  }
});

router.get('/agreements/:agreementId', async (req, res, next) => {
  try {
    const agreementId = validateId(req.params.agreementId, 'agreementId');
    const agreement = await agreementService.getAgreement(agreementId);
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
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.session.message = 'All fields are required.';
      return res.redirect('/client/change-password');
    }

    if (!userService.passwordsMatch(newPassword, confirmPassword)) {
      req.session.message = 'New passwords do not match.';
      return res.redirect('/client/change-password');
    }

    // Change password using service
    const result = await userService.changePassword(req.user.id, currentPassword, newPassword);

    req.session.message = result.message;

    if (result.success) {
      res.redirect('/client');
    } else {
      res.redirect('/client/change-password');
    }
  } catch (err) {
    console.error('Error changing password:', err);
    req.session.message = 'An error occurred while changing password.';
    res.redirect('/client/change-password');
  }
});

module.exports = router;