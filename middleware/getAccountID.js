const db = require('../utils/db.js');
const configService = require('../helpers/configService.js');

async function checkAccount(userID, accountType) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM Accounts WHERE UserID = ? AND AccountTypeID = (SELECT AccountTypeID FROM AccountTypes WHERE AccountTypeName = ?)", [userID, accountType], (err, row) => {
            if (err) {
                return reject(new Error(`Database query error: ${err.message}`));
            }
            resolve(row);
        });
    });
}

async function createAccount(userID) {
    const accountTypes = await configService.getConfig('AccountTypes');
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO Accounts ( AccountTypeID, UserID, Balance) VALUES (?, ?, ?)',
            [
                accountTypes.CHEQUING,
                userID,
                0
            ],
            function (err) {
                if (err) {
                    return reject(err);
                }
                resolve(this.lastID); 
            }
        );
    });
}

async function getAccountID(userID, accountType) {
    const account = await checkAccount(userID, accountType);
    if (account) {
        return account.AccountID;
    }
    return await createAccount(userID);
}

module.exports = getAccountID;