const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }

    // Strip port if accidentally included in DB_HOST
    const dbHost = process.env.DB_HOST.split(':')[0];

    pool = mysql.createPool({
      host:     dbHost,
      port:     parseInt(process.env.DB_PORT),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
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