const db = require('../services/database.service');

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
    async getConfig(table) {
        // Validate table name against whitelist to prevent SQL injection
        if (!ALLOWED_TABLES[table]) {
            throw new Error(`Invalid configuration table: ${table}. Allowed tables: ${Object.keys(ALLOWED_TABLES).join(', ')}`);
        }

        // Use the whitelisted table name (not user input directly)
        const safeTableName = ALLOWED_TABLES[table];

        try {
            const rows = await db.queryMany(`SELECT * FROM ${safeTableName}`);
            return Object.fromEntries(rows.map(row => {
                const [value, key] = Object.values(row); // Convert row object to array
                return [key.toUpperCase(), value];
            }));
        } catch (err) {
            throw new Error(`Database query error: ${err.message}`);
        }
    }
};

module.exports = configService;