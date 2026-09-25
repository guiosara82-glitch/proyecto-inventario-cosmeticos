const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = (process.env.MYSQL_URL || process.env.DATABASE_URL)
  ? mysql.createPool(process.env.MYSQL_URL || process.env.DATABASE_URL)
  : mysql.createPool({
      host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
      user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
      database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'inventario_cosmeticos',
      port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306', 10),
      waitForConnections: true,
      connectionLimit: 10
    });

module.exports = pool;
