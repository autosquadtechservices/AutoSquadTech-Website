const express = require('express');
const app = express();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'your_mysql_password',
  database: process.env.MYSQL_DATABASE || 'autosquad_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.get('/debug/users', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, username, role FROM users");
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = 6000;
app.listen(PORT, () => {
  console.log(`Debug server running on http://localhost:${PORT}`);
});
