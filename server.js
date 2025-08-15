
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const loginRouter = require('./login');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all origins (adjust as needed for security)
app.use(cors());
app.use(express.json());

// Connect to SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Example API endpoint to get all users (adjust table name and fields as needed)
app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ users: rows });
  });
});

// Example API endpoint to add a new user (adjust fields as needed)
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }
  const sql = 'INSERT INTO users (name, email) VALUES (?, ?)';
  db.run(sql, [name, email], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, name, email });
  });
});

// Use login router for /api/auth routes
app.use('/api/auth', loginRouter);

// Start the server
app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
