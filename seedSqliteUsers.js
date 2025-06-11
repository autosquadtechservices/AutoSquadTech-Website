require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

async function seedUsers() {
  try {
    const users = [
      { email: 'admin@example.com', password: 'admin123', role: 'admin' },
      { email: 'employee@example.com', password: 'employee123', role: 'employee' }
    ];

    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      db.get('SELECT * FROM users WHERE email = ?', [userData.email], (err, row) => {
        if (err) {
          console.error('DB error:', err);
          return;
        }
        if (!row) {
          const timestamp = Date.now();
          db.run('INSERT INTO users (email, password, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)', [userData.email, hashedPassword, userData.role, timestamp, timestamp], function(err) {
            if (err) {
              console.error('DB error:', err);
            } else {
              console.log(`Created user: ${userData.email} with role ${userData.role}`);
            }
          });
        } else {
          console.log(`User already exists: ${userData.email}`);
        }
      });
    }
  } catch (error) {
    console.error('Error seeding users:', error);
  }
}

seedUsers();
