const db = require('../utils/db.js');

// Whitelist of allowed configuration tables to prevent SQL injection
const ALLOWED_TABLES = {
    'AccountTypes': 'AccountTypes',
    'Roles': 'Roles',
    'Status': 'Status',
    'TransactionTypes': 'TransactionTypes',
    'LoanTypes': 'LoanTypes'
};

const configService = {
    /**
     * Retrieves configuration data from a specified table
     * @param {string} table - The table name to query (must be in whitelist)
     * @returns {Promise<Object>} - Configuration object with uppercase keys
     * @throws {Error} - If table is not in whitelist or database error occurs
     */
    getConfig: (table) => {
        return new Promise((resolve, reject) => {
            // Validate table name against whitelist to prevent SQL injection
            if (!ALLOWED_TABLES[table]) {
                return reject(new Error(`Invalid configuration table: ${table}. Allowed tables: ${Object.keys(ALLOWED_TABLES).join(', ')}`));
            }

            // Use the whitelisted table name (not user input directly)
            const safeTableName = ALLOWED_TABLES[table];

            db.all(`SELECT * FROM ${safeTableName}`, (err, rows) => {
                if (err) {
                    reject(new Error(`Database query error: ${err.message}`));
                } else {
                    resolve(Object.fromEntries(rows.map(row => {
                        const [value, key] = Object.values(row); // Convert row object to array
                        return [key.toUpperCase(), value];
                    })));
                }
            });
        });
    }
};

module.exports = configService;