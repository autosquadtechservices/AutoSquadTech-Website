require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

const nodemailer = require('nodemailer');
const cors = require('cors');
const corsOptions = {
  origin: ['http://localhost:5501', 'http://127.0.0.1:5501'],
  optionsSuccessStatus: 200
};
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Middlewares
app.use(cors(corsOptions));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'your_mysql_password',
  database: process.env.MYSQL_DATABASE || 'autosquad_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create tables if not exist (fresh start, no migration)
async function initializeDatabase() {
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

    await connection.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        login_time DATETIME,
        logout_time DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        token VARCHAR(255) UNIQUE,
        expires_at BIGINT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Insert default admin user if not exists
    const [rows] = await connection.query("SELECT * FROM users WHERE username = ?", ['admin']);
    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await connection.query("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hashedPassword, 'admin']);
      console.log("Default admin user created");
    }
  } catch (err) {
    console.error("Error initializing database:", err);
  } finally {
    connection.release();
  }
}

initializeDatabase();

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Admin role middleware
function authorizeAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Admins only' });
  }
  next();
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'signin.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'contact.html'));
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const tokenPayload = { id: user.id, username: user.username, role: user.role };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, role: user.role });
  } catch (err) {
    console.error('Database error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Contact form POST endpoint (existing code unchanged)
app.post('/contact', async (req, res) => {
  const { name, email, countryCode, phone, message } = req.body;

  if (!name || !email || !countryCode || !phone || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const phoneLengthLimits = {
    '+1': 10, '+44': 10, '+91': 10, '+86': 11, '+81': 10, '+93': 9, '+355': 9, '+213': 9,
    '+376': 6, '+244': 9, '+672': 6, '+54': 10, '+374': 8, '+297': 7, '+61': 9, '+43': 10,
    '+994': 9, '+973': 8, '+880': 10, '+375': 9, '+32': 9, '+501': 7, '+229': 8, '+975': 8,
  };

  const expectedLength = phoneLengthLimits[countryCode];
  if (!expectedLength) {
    return res.status(400).json({ error: 'Unsupported country code' });
  }

  const digitsOnlyPhone = phone.replace(/\D/g, '');

  if (digitsOnlyPhone.length !== expectedLength) {
    return res.status(400).json({ error: `Phone number must be exactly ${expectedLength} digits for country code ${countryCode}` });
  }

  try {
    let transporter;
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('Using Ethereal test account:', testAccount.user);
    }

    const mailOptions = {
      from: `"AutoSquad Website" <${process.env.EMAIL_USER || 'info@autosquadtech.com'}>`,
      to: process.env.EMAIL_USER || 'info@autosquadtech.com',
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${countryCode} ${phone}</p>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Received:</strong> ${new Date().toLocaleString()}</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Message sent: %s', info.messageId);
    if (nodemailer.getTestMessageUrl) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    res.status(200).json({ success: true, message: 'Thank you! Your message has been sent.' });
  } catch (error) {
    console.error('Error sending email:', error.stack || error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Forgot password request endpoint
app.post('/forgot-password', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate a unique token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 3600000; // 1 hour from now

    // Insert token into password_reset_tokens table
    await pool.query("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)", [user.id, token, expiresAt]);

    // Send email with reset link
    const resetLink = `http://localhost:5501/reset_password.html?token=${token}`;

    let transporter;
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('Using Ethereal test account:', testAccount.user);
    }

    const mailOptions = {
      from: `"AutoSquad Website" <${process.env.EMAIL_USER || 'info@autosquadtech.com'}>`,
      to: user.username,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click the link below to reset your password:</p>
             <a href="${resetLink}">${resetLink}</a>
             <p>This link will expire in 1 hour.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending reset email:', error);
        return res.status(500).json({ error: 'Failed to send reset email' });
      }
      res.json({ message: 'Password reset email sent' });
    });
  } catch (err) {
    console.error('Error processing forgot password:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password endpoint
app.post('/reset-password', async (req, res) => {
  const { token } = req.query;
  const { password } = req.body;

  if (!token) return res.status(400).json({ error: 'Reset token is required' });
  if (!password) return res.status(400).json({ error: 'New password is required' });

  try {
    const [rows] = await pool.query("SELECT * FROM password_reset_tokens WHERE token = ?", [token]);
    const row = rows[0];
    if (!row) return res.status(400).json({ error: 'Invalid or expired reset token' });
    if (row.expires_at < Date.now()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [hash, row.user_id]);
    await pool.query("DELETE FROM password_reset_tokens WHERE id = ?", [row.id]);

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Error processing reset password:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Employee attendance login (record login time)
app.post('/attendance/login', authenticateToken, async (req, res) => {
  if (req.user.role !== 'employee') return res.status(403).json({ error: 'Only employees can record attendance' });

  const userId = req.user.id;
  const loginTime = new Date().toISOString();

  try {
    const [result] = await pool.query("INSERT INTO attendance (user_id, login_time, logout_time) VALUES (?, ?, NULL)", [userId, loginTime]);
    res.json({ message: 'Login time recorded', attendanceId: result.insertId, loginTime: loginTime });
  } catch (err) {
    console.error('Error recording login time:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Employee attendance logout (record logout time)
app.post('/attendance/logout', authenticateToken, async (req, res) => {
  if (req.user.role !== 'employee') return res.status(403).json({ error: 'Only employees can record attendance' });

  const userId = req.user.id;
  const logoutTime = new Date().toISOString();

  try {
    const [rows] = await pool.query("SELECT id FROM attendance WHERE user_id = ? AND logout_time IS NULL ORDER BY login_time DESC LIMIT 1", [userId]);
    const row = rows[0];
    if (!row) return res.status(400).json({ error: 'No active login record found' });

    await pool.query("UPDATE attendance SET logout_time = ? WHERE id = ?", [logoutTime, row.id]);
    res.json({ message: 'Logout time recorded' });
  } catch (err) {
    console.error('Error recording logout time:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin route to get all attendance records
app.get('/admin/attendance', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT attendance.id, users.username, attendance.login_time, attendance.logout_time
      FROM attendance
      JOIN users ON attendance.user_id = users.id
      ORDER BY attendance.login_time DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching attendance records:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin route to get all users
app.get('/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, username, role FROM users");
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Start server
const PORT = 5000; // Force backend to run on port 5000
const server = app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
  throw err;
});
