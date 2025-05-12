require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function addUser(username, password, role) {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'autosquad@1525',
    database: process.env.MYSQL_DATABASE || 'autosquad_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );
    console.log(`User ${username} added successfully with ID ${result.insertId}`);
  } catch (err) {
    console.error('Error adding user:', err);
  } finally {
    await pool.end();
  }
}

const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error('Usage: node add_user.js <username> <password> <role>');
  process.exit(1);
}

addUser(args[0], args[1], args[2]);
