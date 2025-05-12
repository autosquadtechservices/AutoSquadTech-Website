const mysql = require('mysql2/promise');
const process = require('process');

if (process.argv.length < 3) {
  console.log("Usage: node delete_user.js <username>");
  process.exit(1);
}

const username = process.argv[2];

async function deleteUser(username) {
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
    const [result] = await connection.query("DELETE FROM users WHERE username = ?", [username]);
    if (result.affectedRows === 0) {
      console.log(`No user found with username '${username}'.`);
    } else {
      console.log(`User '${username}' deleted successfully.`);
    }
  } catch (err) {
    console.error("Error deleting user", err.message);
  } finally {
    connection.release();
    await pool.end();
  }
}

deleteUser(username);
