const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

if (process.env.MYSQLHOST || process.env.DB_HOST) {
  pool = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'inventario_cosmeticos',
    port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10
  });
} else if (process.env.MYSQL_URL || process.env.DATABASE_URL) {
  pool = mysql.createPool(process.env.MYSQL_URL || process.env.DATABASE_URL);
} else {
  pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'inventario_cosmeticos',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10
  });
}

module.exports = pool;