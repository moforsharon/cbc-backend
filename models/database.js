const mysql = require('mysql');
const pool = mysql.createPool({
    connectionLimit: 10,
    host: '165.227.154.82', // Ensure the host is correct and reachable
    user: 'root',
    password: 'root',
    database: 'cbc'
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle database connection', err);
    process.exit(-1);
});

module.exports = pool;
