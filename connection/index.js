require("dotenv").config();
const config = require("config");
const mysql = require("mysql2");
const { response } = require("../response");

const myDb = mysql.createPool({
  connectionLimit: 10,
  socketTimeout: 30000,
  // host:  process.env.NEXT_PUBLIC_HOST, //config.get("DATABASE.HOST"),
  // user: process.env.NEXT_PUBLIC_USERNAME, //config.get("DATABASE.USER"),
  // password: process.env.NEXT_PUBLIC_PASS, //config.get("DATABASE.PASSWORD"),
  // database: process.env.NEXT_PUBLIC_DB, //config.get("DATABASE.NAME"),
  host:  "165.227.154.82",
  user:  "root",
  password: "root",
  database: "cbc",
  multipleStatements: true,
});

function beginTransaction() {
  return new Promise((resolve, reject) => {
    myDb.getConnection((error, connection) => {
      if (error) {
        reject(error);
      } else {
        connection.beginTransaction((error) => {
          if (error) {
            connection.release();
            reject(error);
          } else {
            resolve(connection);
          }
        });
      }
    });
  });
}

function rollbackTransaction(connection) {
  return new Promise((resolve, reject) => {
    connection.rollback(() => {
      connection.release();
      resolve();
    });
  });
}

function commitTransaction(connection) {
  return new Promise((resolve, reject) => {
    connection.commit((error) => {
      if (error) {
        reject(error);
      } else {
        connection.release();
        resolve();
      }
    });
  });
}

// Example usage
async function insert(req, res) {
  try {
    const connection = await beginTransaction();

    // Perform database operations within the transaction
    // ...

    await commitTransaction(connection);

    res.status(200).json(response(null, null, "Transaction successful"));
  } catch (error) {
    await rollbackTransaction(connection);
    res.status(500).json(response(null, null, "Transaction failed", false));
  }
}

// const myDb_blogs = mysql.createConnection({
//   host: "127.0.0.1",
//   user: "root",
//   password: "28464",
//   connectionLimit: 10,
//   multipleStatements: true,
//   database: "chatdox_web",
// });

// myDb_blogs.connect((err) => {
//   if (!err) {
//     console.log("connection success", err);
//   } else {
//     console.log("not connected:" + JSON.stringify(err));
//   }
// });

module.exports = {
  myDb,
  // myDb_blogs,
  beginTransaction,
  rollbackTransaction,
  commitTransaction,
};
