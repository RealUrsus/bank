const db = require('../utils/db.js');

const configService = {
    getConfig: (table) => {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM ${table}`, (err, rows) => {
                if (err) reject(new Error(`Database query error: ${err.message}`));
                else resolve(Object.fromEntries(rows.map(row => {
                    const [value, key] = Object.values(row); // Convert row object to array
                    return [key.toUpperCase(), value];
                })));
            });
        });
    }
};

module.exports = configService;