const mysql = require('mysql2/promise');

// Per the GoDaddy Node.js hosting deploy contract, DB credentials come from
// process.env (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD) - .env files
// are not uploaded, so these are set in the hosting dashboard.
let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: false
    });
  }
  return pool;
}

async function connectDB() {
  const conn = await getPool().getConnection();
  try {
    await conn.query('SELECT 1');
    console.log('MySQL connected...');
  } finally {
    conn.release();
  }
}

module.exports = { getPool, connectDB };
