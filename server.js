require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const app = express();
const PORT = process.env.PORT || 5000;
console.log(`Starting server on port ${PORT}`);

const allowedOrigins = ['https://www.autosquadtech.com', 'https://your-frontend-domain.com'];

app.use(cors({
  origin: function(origin, callback){
    // allow requests with no origin (like mobile apps or curl requests)
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(bodyParser.json());

// Helper function to generate JWT
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Middleware for role-based access control
function authorizeRole(role) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('JWT verification error:', err);
        return res.status(401).json({ message: 'Invalid token' });
      }
      console.log('Decoded token:', decoded);
      if (decoded.role !== role) return res.status(403).json({ message: 'Forbidden' });
      req.user = decoded;
      next();
    });
  };
}

// Setup SQLite database
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('employee', 'admin')) NOT NULL DEFAULT 'employee',
    resetToken TEXT,
    resetTokenExpiry INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    loginTime INTEGER NOT NULL,
    logoutTime INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);
});

// Sign-in route
app.post('/api/signin', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid email or password' });

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  });
});

// Add new user route
app.post('/api/users', (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Email, password, and role are required' });
  }
  if (!['employee', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Role must be either employee or admin' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, hashedPassword, role], function(err) {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.status(201).json({ message: 'User created successfully', user: { id: this.lastID, email, role } });
    });
  });
});

// Employee attendance login
app.post('/api/attendance/login', authorizeRole('employee'), (req, res) => {
  const userId = req.user.id;
  const now = Date.now();

  db.get('SELECT * FROM attendance WHERE userId = ? AND logoutTime IS NULL', [userId], (err, existingAttendance) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (existingAttendance) {
      return res.status(400).json({ message: 'Already logged in for today.' });
    }

    db.run('INSERT INTO attendance (userId, loginTime, logoutTime) VALUES (?, ?, NULL)', [userId, now], function(err) {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json({ message: 'Login time recorded.', attendanceId: this.lastID });
    });
  });
});

// Employee attendance logout
app.post('/api/attendance/logout', authorizeRole('employee'), (req, res) => {
  const userId = req.user.id;
  const now = Date.now();

  db.get('SELECT * FROM attendance WHERE userId = ? AND logoutTime IS NULL ORDER BY loginTime DESC LIMIT 1', [userId], (err, attendance) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (!attendance) {
      return res.status(400).json({ message: 'No active login found.' });
    }

    db.run('UPDATE attendance SET logoutTime = ? WHERE id = ?', [now, attendance.id], function(err) {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json({ message: 'Logout time recorded.', attendanceId: attendance.id });
    });
  });
});

// Get today's attendance for the logged-in employee
app.get('/api/attendance/today', authorizeRole('employee'), (req, res) => {
  const userId = req.user.id;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  db.get(
    `SELECT * FROM attendance WHERE userId = ? AND loginTime BETWEEN ? AND ? ORDER BY loginTime DESC LIMIT 1`,
    [userId, startOfDay.getTime(), endOfDay.getTime()],
    (err, attendance) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json({ attendance });
    }
  );
});

// Admin get attendance records
app.get('/api/admin/attendance', authorizeRole('admin'), (req, res) => {
  db.all(
    `SELECT attendance.id, users.email as userEmail, attendance.loginTime, attendance.logoutTime
     FROM attendance
     JOIN users ON attendance.userId = users.id
     ORDER BY attendance.loginTime DESC`,
    [],
    (err, records) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      const formattedRecords = records.map((record) => {
        const login = new Date(record.loginTime);
        const logout = record.logoutTime ? new Date(record.logoutTime) : null;
        const date = login.toLocaleDateString('en-GB'); // dd/mm/yyyy
        const day = login.toLocaleDateString('en-GB', { weekday: 'long' });
        let totalTime = null;
        if (logout) {
          const diffMs = logout - login;
          const diffHrs = Math.floor(diffMs / 3600000);
          const diffMins = Math.floor((diffMs % 3600000) / 60000);
          totalTime = `${diffHrs}h ${diffMins}m`;
        }
        return {
          id: record.id,
          userEmail: record.userEmail,
          date,
          day,
          loginTime: login.toLocaleTimeString('en-GB'),
          logoutTime: logout ? logout.toLocaleTimeString('en-GB') : null,
          totalTime,
        };
      });

      res.json(formattedRecords);
    }
  );
});

// Forgot password route
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (!user) return res.status(400).json({ message: 'Email not found' });

    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    db.run('UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE id = ?', [resetToken, resetTokenExpiry, user.id], (err) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      const frontendUrl = req.headers.origin || process.env.FRONTEND_URL || '';
      const resetUrl = `${frontendUrl}/reset_password.html?token=${resetToken}&email=${email}`;

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Password Reset Request',
        html: `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password. This link is valid for 1 hour.</p>`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Mail error:', error);
          return res.status(500).json({ message: 'Server error' });
        }
        res.json({ message: 'Password reset email sent' });
      });
    });
  });
});

// Reset password route
app.post('/api/reset-password', (req, res) => {
  const { email, token, newPassword } = req.body;
  db.get('SELECT * FROM users WHERE email = ? AND resetToken = ?', [email, token], async (err, user) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (!user) return res.status(400).json({ message: 'Invalid token or email' });

    if (user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ message: 'Token expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?', [hashedPassword, user.id], (err) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      res.json({ message: 'Password reset successful' });
    });
  });
});

// Temporary debug endpoint to list all users
app.get('/api/debug/users', (req, res) => {
  db.all('SELECT id, email, role FROM users', [], (err, users) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(users);
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
