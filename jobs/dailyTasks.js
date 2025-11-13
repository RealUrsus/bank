const cron = require('node-cron');
const loanService = require('../services/loan.service');
const gicService = require('../services/gic.service');

/**
 * Process loan interest payments based on payment frequency (monthly or annual)
 */
async function processLoanInterest() {
  console.log('[Daily Task] Processing loan interest payments...');
  const activeLoans = await loanService.getActiveLoans();
  let processedCount = 0;

  for (const loan of activeLoans) {
    try {
      const transactionId = await loanService.processLoanInterest(loan.AccountID);
      if (transactionId) {
        processedCount++;
        console.log(`Interest payment processed for loan ${loan.AccountID}`);
      }
    } catch (error) {
      console.error(`Error processing interest for loan ${loan.AccountID}:`, error);
    }
  }

  console.log(`[Daily Task] Processed ${processedCount} loan interest payments`);
}

/**
 * Check for paid off loans and update their status
 */
async function checkLoanPayoffs() {
  console.log('[Daily Task] Checking loan payoffs...');
  const activeLoans = await loanService.getActiveLoans();
  let paidOffCount = 0;

  for (const loan of activeLoans) {
    try {
      const wasPaidOff = await loanService.checkLoanPayoff(loan.AccountID);
      if (wasPaidOff) {
        paidOffCount++;
        console.log(`Loan ${loan.AccountID} marked as paid off`);
      }
    } catch (error) {
      console.error(`Error checking payoff for loan ${loan.AccountID}:`, error);
    }
  }

  console.log(`[Daily Task] Marked ${paidOffCount} loans as paid off`);
}

/**
 * Check for loan maturity, log to file, and withdraw remaining balance from checking
 */
async function checkLoanMaturity() {
  console.log('[Daily Task] Checking loan maturity...');
  const activeLoans = await loanService.getActiveLoans();
  let maturedCount = 0;

  for (const loan of activeLoans) {
    try {
      const wasProcessed = await loanService.checkLoanMaturity(loan.AccountID);
      if (wasProcessed) {
        maturedCount++;
        console.log(`Loan ${loan.AccountID} has matured - logged and final payment withdrawn`);
      }
    } catch (error) {
      console.error(`Error processing maturity for loan ${loan.AccountID}:`, error);
    }
  }

  console.log(`[Daily Task] Processed ${maturedCount} matured loans`);
}

/**
 * Check for GIC maturity and process accordingly
 */
async function checkGICMaturity() {
  console.log('[Daily Task] Checking GIC maturity...');
  const activeGICs = await gicService.getActiveGICs();
  let maturedCount = 0;

  for (const gic of activeGICs) {
    try {
      const wasMatured = await gicService.matureGIC(gic.AccountID);
      if (wasMatured) {
        maturedCount++;
        console.log(`GIC ${gic.AccountID} has matured and funds transferred`);
      }
    } catch (error) {
      console.error(`Error maturing GIC ${gic.AccountID}:`, error);
    }
  }

  console.log(`[Daily Task] Matured ${maturedCount} GICs`);
}

/**
 * Run all daily tasks
 */
async function runDailyTasks() {
  console.log('='.repeat(50));
  console.log(`[Daily Task] Starting daily tasks at ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  try {
    // Process loan operations
    await processLoanInterest();
    await checkLoanPayoffs();
    await checkLoanMaturity();

    // Process GIC operations
    await checkGICMaturity();

    console.log('='.repeat(50));
    console.log('[Daily Task] All daily tasks completed successfully');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('[Daily Task] Error running daily tasks:', error);
  }
}

// Schedule daily tasks to run at midnight
cron.schedule('0 0 * * *', async () => {
  await runDailyTasks();
});

// Export for manual testing
module.exports = {
  runDailyTasks,
  processLoanInterest,
  checkLoanPayoffs,
  checkLoanMaturity,
  checkGICMaturity
};