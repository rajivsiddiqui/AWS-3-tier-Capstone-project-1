const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '3306'),
      user:     process.env.DB_USER     || 'appuser',
      password: process.env.DB_PASSWORD || 'apppassword',
      database: process.env.DB_NAME     || 'capstone',
      waitForConnections: true,
      connectionLimit:    10,
    });
  }
  return pool;
}

async function initDB() {
  const db = getPool();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      status      ENUM('todo','in-progress','done') DEFAULT 'todo',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Database initialised');
}

module.exports = { getPool, initDB };