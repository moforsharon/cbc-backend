const { response } = require("../response");
const { myDb } = require("../connection");

async function RunQuery(query, values) {
  return new Promise((resolve, reject) => {
    myDb.query(query, values, (err, result) => {
      if (err) {
        reject(response(null, err, "err"));
      } else {
        resolve(response(result, null, ""));
      }
    });
  });
}

async function RunTransactionQuery(query, connectionForTransaction, values) {
  return new Promise((resolve, reject) => {
    connectionForTransaction.query(query, values, (err, result) => {
      if (err) {
        reject(response(null, err, "err"));
      } else {
        resolve(response(result, null, ""));
      }
    });
  });
}

module.exports = { RunQuery, RunTransactionQuery };
