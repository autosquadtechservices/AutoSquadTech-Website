const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');

async function migrate() {
  // Connect to SQLite
  const sqliteDb = new sqlite3.Database('db.sqlite', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error opening SQLite DB:', err.message);
      process.exit(1);
    }
  });

  // Connect to MySQL
  const mysqlConnection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'your_mysql_password',
    database: 'autosquad_db'
  });

  // Create tables in MySQL
  await mysqlConnection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      role ENUM('admin', 'employee') NOT NULL
    );
  `);

  await mysqlConnection.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      login_time DATETIME,
      logout_time DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await mysqlConnection.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      token VARCHAR(255) UNIQUE,
      expires_at BIGINT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migrate users
  sqliteDb.all("SELECT * FROM users", async (err, rows) => {
    if (err) {
      console.error('Error reading users from SQLite:', err.message);
      process.exit(1);
    }
    for (const row of rows) {
      try {
        await mysqlConnection.query(
          "INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE username=VALUES(username)",
          [row.id, row.username, row.password, row.role]
        );
      } catch (e) {
        console.error('Error inserting user:', e.message);
      }
    }
    console.log('Users migrated successfully.');
  });

  // Migrate attendance
  sqliteDb.all("SELECT * FROM attendance", async (err, rows) => {
    if (err) {
      console.error('Error reading attendance from SQLite:', err.message);
      process.exit(1);
    }
    for (const row of rows) {
      try {
        await mysqlConnection.query(
          "INSERT INTO attendance (id, user_id, login_time, logout_time) VALUES (?, ?, ?, ?)",
          [row.id, row.user_id, row.login_time, row.logout_time]
        );
      } catch (e) {
        console.error('Error inserting attendance:', e.message);
      }
    }
    console.log('Attendance migrated successfully.');
  });

  // Migrate password_reset_tokens
  sqliteDb.all("SELECT * FROM password_reset_tokens", async (err, rows) => {
    if (err) {
      console.error('Error reading password_reset_tokens from SQLite:', err.message);
      process.exit(1);
    }
    for (const row of rows) {
      try {
        await mysqlConnection.query(
          "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
          [row.id, row.user_id, row.token, row.expires_at]
        );
      } catch (e) {
        console.error('Error inserting password_reset_token:', e.message);
      }
    }
    console.log('Password reset tokens migrated successfully.');
    await mysqlConnection.end();
    sqliteDb.close();
  });
}

migrate().catch(err => {
  console.error('Migration failed:', err);
});
