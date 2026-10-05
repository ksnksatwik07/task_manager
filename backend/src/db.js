const mysql = require('mysql2/promise');

// All connection settings come from environment variables (no hardcoded secrets).
const config = {
  host: process.env.MYSQL_HOST || 'mysql',
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
};

const pool = mysql.createPool(config);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// MySQL can take 20-60s to start. Retry instead of crashing.
async function waitForDb(retries = 30, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log(`Connected to MySQL at ${config.host}:${config.port}`);
      return;
    } catch (err) {
      console.log(`MySQL not ready (attempt ${attempt}/${retries}): ${err.code || err.message}`);
      await sleep(delayMs);
    }
  }
  throw new Error('Could not connect to MySQL, giving up');
}

// Safety net: make sure the table exists even if init.sql did not run.
async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}

module.exports = { pool, waitForDb, ensureSchema };
