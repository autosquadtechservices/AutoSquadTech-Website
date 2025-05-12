const mysql = require('mysql2/promise');

async function createUsersTable() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'your_mysql_password',
    database: process.env.MYSQL_DATABASE || 'autosquad_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        role ENUM('admin', 'employee') NOT NULL
      )
    `);
    console.log("Users table created or already exists.");
  } catch (err) {
    console.error("Error creating users table", err.message);
  } finally {
    connection.release();
    await pool.end();
    console.log("Database connection closed.");
  }
}

createUsersTable();
