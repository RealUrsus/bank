# First Home Bank

A web-based banking simulator designed to teach teenagers financial literacy through hands-on experience with real-world banking concepts.

## Overview

First Home Bank provides a safe, educational environment where teens can learn about money management, savings, loans, and investments without real financial risk. Parents or educators act as bank administrators, while teens experience banking operations from a client perspective.

## Features

### For Teens (Clients)
- **Account Management** - View balance and transaction history
- **Transactions** - Record deposits, withdrawals, and transfers
- **Loan Applications** - Apply for loans with interest calculations and payment schedules
- **GIC Investments** - Purchase Guaranteed Investment Certificates to learn about fixed-income investments
- **Financial Tracking** - Monitor account activity and financial growth over time

### For Parents/Educators (Admins)
- **Client Management** - Create and manage teen accounts
- **Loan Administration** - Review and approve/deny loan requests
- **Transaction Oversight** - Monitor and manage all financial activities
- **Investment Products** - Configure GIC products with different terms and rates
- **Automated Processing** - Daily interest calculations and payment processing

## Tech Stack

- **Backend**: Node.js, Express.js
- **Authentication**: Passport.js with local strategy
- **Database**: SQLite3
- **Views**: EJS templates
- **Security**: Helmet, CSRF protection, express-validator
- **Scheduling**: node-cron for automated daily tasks

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and configure settings
4. Start the application:
   ```bash
   npm start
   ```
5. Access at `http://localhost:8000`

## License

Unlicense
