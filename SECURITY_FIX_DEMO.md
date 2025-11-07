# SQL Injection Vulnerability Fix

## Location
`helpers/configService.js:6`

## Vulnerability Description
The original code used string interpolation to insert table names directly into SQL queries:

```javascript
// VULNERABLE CODE (BEFORE)
db.all(`SELECT * FROM ${table}`, (err, rows) => {
```

This allowed potential SQL injection attacks if an attacker could control the `table` parameter.

### Attack Example
```javascript
// Malicious input
configService.getConfig("Users; DROP TABLE Users--")
// Would execute: SELECT * FROM Users; DROP TABLE Users--
```

## Fix Applied
Implemented a **whitelist validation** approach:

```javascript
// SECURE CODE (AFTER)
const ALLOWED_TABLES = {
    'AccountTypes': 'AccountTypes',
    'Roles': 'Roles',
    'Status': 'Status',
    'TransactionTypes': 'TransactionTypes',
    'LoanTypes': 'LoanTypes'
};

// Validate before using
if (!ALLOWED_TABLES[table]) {
    return reject(new Error(`Invalid configuration table: ${table}`));
}
const safeTableName = ALLOWED_TABLES[table];
db.all(`SELECT * FROM ${safeTableName}`, ...);
```

## Security Benefits
1. **Whitelist validation**: Only predefined table names are allowed
2. **Clear error messages**: Invalid tables are rejected with helpful errors
3. **No direct user input**: User input is validated before being used
4. **Defense in depth**: Even if input validation fails elsewhere, this prevents exploitation

## Testing
```javascript
// Valid usage - WORKS
await configService.getConfig('Roles');
// Returns: { ADMIN: 1, AUDITOR: 2, CLIENT: 3 }

// SQL injection attempt - BLOCKED
await configService.getConfig('Users; DROP TABLE Users--');
// Throws: Error: Invalid configuration table: Users; DROP TABLE Users--
```

## Impact
- **Before**: Critical security vulnerability (OWASP A03:2021 - Injection)
- **After**: Secure against SQL injection attacks on this endpoint
