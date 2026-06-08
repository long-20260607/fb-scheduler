const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('数据库连接池错误:', err.message);
});

async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (err.message.includes('Connection terminated') || err.message.includes('ECONNRESET')) {
      console.warn('数据库连接断开，重试中...');
      return await pool.query(text, params);
    }
    throw err;
  }
}

module.exports = {
  query,
  pool
};
