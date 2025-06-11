
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

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

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(bodyParser.json());

// Setup Mongoose connection to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autosquad', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// User schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true,
    match: /.+\@.+\..+/,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['employee', 'admin'],
    required: true,
    default: 'employee',
  },
  resetToken: String,
  resetTokenExpiry: Date,
});

const User = mongoose.model('User', userSchema);

// Attendance schema
const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  loginTime: {
    type: Date,
    required: true,
  },
  logoutTime: Date,
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

// Add this block once to create a test user
(async () => {
  const email = 'test@example.com';
  const password = await bcrypt.hash('password123', 10);
  const existingUser = await User.findOne({ email });
  if (!existingUser) {
    const user = new User({ email, password, role: 'employee' });
    await user.save();
    console.log('Test user created:', email);
  }
})();

// Helper function to generate JWT
function generateToken(user) {
  return jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Middleware for role-based access control
function authorizeRole(role) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return res.status(401).json({ message: 'Invalid token' });
      if (decoded.role !== role) return res.status(403).json({ message: 'Forbidden' });
      req.user = decoded;
      next();
    });
  };
}

// Routes

// Sign-in route
app.post('/api/signin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid email or password' });

    const token = generateToken(user);
    res.json({ token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new user route
app.post('/api/users', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Email, password, and role are required' });
  }
  if (!['employee', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Role must be either employee or admin' });
  }
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, role });
    await newUser.save();
    res.status(201).json({ message: 'User created successfully', user: { id: newUser._id, email: newUser.email, role: newUser.role } });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Employee attendance login
app.post('/api/attendance/login', authorizeRole('employee'), async (req, res) => {
  try {
    // Check if already logged in (no logoutTime)
    const existingAttendance = await Attendance.findOne({
      userId: req.user.id,
      logoutTime: null,
    });
    if (existingAttendance) {
      return res.status(400).json({ message: 'Already logged in for today.' });
    }
    // Create new attendance record
    const attendance = new Attendance({
      userId: req.user.id,
      loginTime: new Date(),
      logoutTime: null,
    });
    await attendance.save();
    res.json({ message: 'Login time recorded.', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Employee attendance logout
app.post('/api/attendance/logout', authorizeRole('employee'), async (req, res) => {
  try {
    // Find the latest open attendance record
    const attendance = await Attendance.findOne({
      userId: req.user.id,
      logoutTime: null,
    }).sort({ loginTime: -1 });
    if (!attendance) {
      return res.status(400).json({ message: 'No active login found.' });
    }
    attendance.logoutTime = new Date();
    await attendance.save();
    res.json({ message: 'Logout time recorded.', attendance });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get today's attendance for the logged-in employee
app.get('/api/attendance/today', authorizeRole('employee'), async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const attendance = await Attendance.findOne({
      userId: req.user.id,
      loginTime: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ loginTime: -1 });

    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin get attendance records
app.get('/api/admin/attendance', authorizeRole('admin'), async (req, res) => {
  try {
    const records = await Attendance.find()
      .populate('userId', 'email')
      .sort({ loginTime: -1 });

    // Format records with date, day, total working time
    const formattedRecords = records.map((record) => {
      const login = record.loginTime;
      const logout = record.logoutTime;
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
        id: record._id,
        userEmail: record.userId.email,
        date,
        day,
        loginTime: login.toLocaleTimeString('en-GB'),
        logoutTime: logout ? logout.toLocaleTimeString('en-GB') : null,
        totalTime,
      };
    });

    res.json(formattedRecords);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password route
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email not found' });

    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    const frontendUrl = req.headers.origin || process.env.FRONTEND_URL || '';
    const resetUrl = `${frontendUrl}/reset_password.html?token=${resetToken}&email=${email}`;

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password. This link is valid for 1 hour.</p>`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password route
app.post('/api/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  try {
    const user = await User.findOne({ email, resetToken: token });
    if (!user) return res.status(400).json({ message: 'Invalid token or email' });

    if (user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ message: 'Token expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Temporary debug endpoint to list all users
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await User.find({}, 'email role');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
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
