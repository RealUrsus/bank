/**
 * Financial calculation service
 * Handles interest calculations, maturity dates, payment schedules, etc.
 */

const financialService = {
  /**
   * Calculate simple interest for a given period
   * @param {number} principal - Principal amount
   * @param {number} annualRate - Annual interest rate (as percentage, e.g., 5 for 5%)
   * @param {number} days - Number of days
   * @returns {number} Interest amount
   */
  calculateSimpleInterest(principal, annualRate, days) {
    const dailyRate = annualRate / 100 / 365;
    return principal * dailyRate * days;
  },

  /**
   * Calculate compound interest
   * @param {number} principal - Principal amount
   * @param {number} annualRate - Annual interest rate (as percentage)
   * @param {number} compoundingPeriods - Number of times interest compounds per year
   * @param {number} years - Number of years
   * @returns {number} Total amount with compound interest
   */
  calculateCompoundInterest(principal, annualRate, compoundingPeriods, years) {
    const rate = annualRate / 100;
    const amount = principal * Math.pow(
      (1 + rate / compoundingPeriods),
      compoundingPeriods * years
    );
    return amount - principal; // Return only the interest portion
  },

  /**
   * Calculate the number of days between two dates
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {number} Number of days
   */
  calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Calculate maturity date based on start date and term
   * @param {Date|string} startDate - Start date
   * @param {number} termMonths - Term in months
   * @returns {Date} Maturity date
   */
  calculateMaturityDate(startDate, termMonths) {
    const maturity = new Date(startDate);
    maturity.setMonth(maturity.getMonth() + termMonths);
    return maturity;
  },

  /**
   * Check if an account has reached maturity
   * @param {Date|string} startDate - Start date
   * @param {number} termMonths - Term in months
   * @returns {boolean} True if matured
   */
  hasReachedMaturity(startDate, termMonths) {
    const maturityDate = this.calculateMaturityDate(startDate, termMonths);
    return new Date() >= maturityDate;
  },

  /**
   * Calculate monthly payment for a loan (amortization)
   * @param {number} principal - Loan principal
   * @param {number} annualRate - Annual interest rate (as percentage)
   * @param {number} termMonths - Term in months
   * @returns {number} Monthly payment amount
   */
  calculateMonthlyPayment(principal, annualRate, termMonths) {
    const monthlyRate = annualRate / 100 / 12;

    if (monthlyRate === 0) {
      return principal / termMonths;
    }

    const payment = principal * (
      monthlyRate * Math.pow(1 + monthlyRate, termMonths)
    ) / (
      Math.pow(1 + monthlyRate, termMonths) - 1
    );

    return payment;
  },

  /**
   * Calculate payment amount based on payment frequency
   * @param {number} principal - Loan principal
   * @param {number} annualRate - Annual interest rate (as percentage)
   * @param {number} termMonths - Term in months
   * @param {string} frequency - Payment frequency (Monthly, Biweekly, Weekly)
   * @returns {number} Payment amount
   */
  calculatePaymentByFrequency(principal, annualRate, termMonths, frequency) {
    const monthlyPayment = this.calculateMonthlyPayment(principal, annualRate, termMonths);

    switch (frequency) {
      case 'Monthly':
        return monthlyPayment;
      case 'Biweekly':
        return monthlyPayment * 12 / 26; // 26 biweekly periods per year
      case 'Weekly':
        return monthlyPayment * 12 / 52; // 52 weekly periods per year
      default:
        return monthlyPayment;
    }
  },

  /**
   * Calculate accrued interest since last calculation
   * Used for daily interest accrual on loans and GICs
   * @param {number} currentBalance - Current balance
   * @param {number} annualRate - Annual interest rate (as percentage)
   * @param {number} daysSinceLastAccrual - Days since last interest accrual
   * @returns {number} Interest amount
   */
  calculateAccruedInterest(currentBalance, annualRate, daysSinceLastAccrual = 1) {
    return this.calculateSimpleInterest(currentBalance, annualRate, daysSinceLastAccrual);
  },

  /**
   * Calculate total interest over the life of a loan
   * @param {number} principal - Loan principal
   * @param {number} annualRate - Annual interest rate (as percentage)
   * @param {number} termMonths - Term in months
   * @returns {number} Total interest paid
   */
  calculateTotalLoanInterest(principal, annualRate, termMonths) {
    const monthlyPayment = this.calculateMonthlyPayment(principal, annualRate, termMonths);
    return (monthlyPayment * termMonths) - principal;
  },

  /**
   * Calculate GIC maturity value (with compound interest)
   * @param {number} principal - Initial investment
   * @param {number} annualRate - Annual interest rate (as percentage)
   * @param {number} termMonths - Term in months
   * @returns {number} Maturity value
   */
  calculateGICMaturityValue(principal, annualRate, termMonths) {
    const years = termMonths / 12;
    const compoundingPeriods = 12; // Monthly compounding
    return principal + this.calculateCompoundInterest(principal, annualRate, compoundingPeriods, years);
  }
};

module.exports = financialService;
