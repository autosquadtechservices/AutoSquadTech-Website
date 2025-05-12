const mysql = require('mysql2/promise');

async function checkTables() {
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
    const [rows] = await connection.query("SHOW TABLES");
    console.log("Tables in database:");
    rows.forEach(row => {
      console.log(Object.values(row)[0]);
    });
  } catch (err) {
    console.error("Error querying tables", err.message);
  } finally {
    connection.release();
    await pool.end();
  }
}

checkTables();
