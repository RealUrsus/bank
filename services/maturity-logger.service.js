/**
 * Maturity Logger Service
 * Unified logging for loan and GIC maturity events
 */

const fs = require('fs');
const path = require('path');

// Ensure log directory exists
const logDir = path.join(__dirname, '../var/log');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const maturityLoggerService = {
  /**
   * Log loan approval event
   * @param {object} data - Loan approval data
   */
  logLoanApproval(data) {
    const { loanId, userId, userName, principal, rate, term, startDate, frequency } = data;
    const timestamp = new Date().toISOString();
    const logFile = path.join(logDir, 'loans.log');

    const logEntry = `[${timestamp}] LOAN_APPROVED | Loan_ID: ${loanId} | User: ${userName} (ID: ${userId}) | Principal: $${principal.toFixed(2)} | Rate: ${rate}% | Term: ${term} months | Start_Date: ${startDate} | Payment_Frequency: ${frequency}\n`;

    fs.appendFileSync(logFile, logEntry, 'utf8');
  },

  /**
   * Log loan disbursement event
   * @param {object} data - Loan disbursement data
   */
  logLoanDisbursement(data) {
    const { loanId, userId, userName, principal, chequingAccountId } = data;
    const timestamp = new Date().toISOString();
    const logFile = path.join(logDir, 'loans.log');

    const logEntry = `[${timestamp}] LOAN_DISBURSED | Loan_ID: ${loanId} | User: ${userName} (ID: ${userId}) | Amount: $${principal.toFixed(2)} | Chequing_Account: ${chequingAccountId} | Status: ACTIVE\n`;

    fs.appendFileSync(logFile, logEntry, 'utf8');
  },

  /**
   * Log loan maturity event
   * @param {object} data - Loan maturity data
   */
  logLoanMaturity(data) {
    const { loanId, userId, userName, principal, balancePaid, remaining } = data;
    const timestamp = new Date().toISOString();
    const logFile = path.join(logDir, 'loans.log');

    const logEntry = `[${timestamp}] LOAN_MATURITY | Loan_ID: ${loanId} | User: ${userName} (ID: ${userId}) | Principal: $${principal.toFixed(2)} | Balance_Paid: $${balancePaid.toFixed(2)} | Remaining: $${remaining.toFixed(2)}\n`;

    fs.appendFileSync(logFile, logEntry, 'utf8');
  },

  /**
   * Log loan closure event
   * @param {object} data - Loan closure data
   */
  logLoanClosure(data) {
    const { loanId, userId, finalPayment } = data;
    const timestamp = new Date().toISOString();
    const logFile = path.join(logDir, 'loans.log');

    const logEntry = `[${timestamp}] LOAN_CLOSED | Loan_ID: ${loanId} | User_ID: ${userId} | Final_Payment: $${finalPayment.toFixed(2)} | Status: CLOSED\n`;

    fs.appendFileSync(logFile, logEntry, 'utf8');
  },

  /**
   * Log GIC purchase/start event
   * @param {object} data - GIC purchase data
   */
  logGICPurchase(data) {
    const { gicId, userId, userName, productName, principal, rate, term, startDate, chequingAccountId } = data;
    const timestamp = new Date().toISOString();
    const logFile = path.join(logDir, 'gic.log');

    const logEntry = `[${timestamp}] GIC_PURCHASED | GIC_ID: ${gicId} | User: ${userName} (ID: ${userId}) | Product: ${productName} | Principal: $${principal.toFixed(2)} | Rate: ${rate}% | Term: ${term} months | Start_Date: ${startDate} | Chequing_Account: ${chequingAccountId} | Status: ACTIVE\n`;

    fs.appendFileSync(logFile, logEntry, 'utf8');
  },

  /**
   * Log GIC maturity event
   * @param {object} data - GIC maturity data
   */
  logGICMaturity(data) {
    const { gicId, userId, productName, principal, term, startDate } = data;
    const timestamp = new Date().toISOString();
    const logFile = path.join(logDir, 'gic.log');

    const logEntry = `[${timestamp}] GIC_MATURITY | GIC_ID: ${gicId} | User_ID: ${userId} | Product: ${productName} | Principal: $${principal.toFixed(2)} | Term: ${term} months | Start: ${startDate}\n`;

    fs.appendFileSync(logFile, logEntry, 'utf8');
  },

  /**
   * Log GIC payoff/closure event
   * @param {object} data - GIC payoff data
   */
  logGICPayoff(data) {
    const { gicId, userId, maturityValue, interestEarned, chequingAccountId } = data;
    const timestamp = new Date().toISOString();
    const logFile = path.join(logDir, 'gic.log');

    const logEntry = `[${timestamp}] GIC_PAYOFF | GIC_ID: ${gicId} | User_ID: ${userId} | Maturity_Value: $${maturityValue.toFixed(2)} | Interest_Earned: $${interestEarned.toFixed(2)} | Chequing_Account: ${chequingAccountId} | Status: CLOSED\n`;

    fs.appendFileSync(logFile, logEntry, 'utf8');
  },

  /**
   * Log general maturity processing summary
   * @param {string} type - 'loan' or 'gic'
   * @param {number} count - Number of accounts processed
   */
  logDailySummary(type, count) {
    const timestamp = new Date().toISOString();
    const logFile = path.join(logDir, `${type}s.log`);

    const logEntry = `[${timestamp}] DAILY_SUMMARY | Processed ${count} matured ${type}(s)\n`;

    fs.appendFileSync(logFile, logEntry, 'utf8');
  }
};

module.exports = maturityLoggerService;
