require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

const nodemailer = require('nodemailer');
const cors = require('cors');

// Middlewares
app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'contact.html'));
});

// Contact form POST endpoint
app.post('/contact', async (req, res) => {
  const { name, email, countryCode, phone, message } = req.body;

  if (!name || !email || !countryCode || !phone || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Mapping of country codes to phone number length limits (example)
  const phoneLengthLimits = {
    '+1': 10,    // USA
    '+44': 10,   // UK
    '+91': 10,   // India
    '+86': 11,   // China
    '+81': 10,   // Japan
    '+93': 9,    // Afghanistan
    '+355': 9,   // Albania
    '+213': 9,   // Algeria
    '+376': 6,   // Andorra
    '+244': 9,   // Angola
    '+672': 6,   // Australian Antarctic Territory
    '+54': 10,   // Argentina
    '+374': 8,   // Armenia
    '+297': 7,   // Aruba
    '+61': 9,    // Australia
    '+43': 10,   // Austria
    '+994': 9,   // Azerbaijan
    '+973': 8,   // Bahrain
    '+880': 10,  // Bangladesh
    '+375': 9,   // Belarus
    '+32': 9,    // Belgium
    '+501': 7,   // Belize
    '+229': 8,   // Benin
    '+975': 8,   // Bhutan
  };

  const expectedLength = phoneLengthLimits[countryCode];
  if (!expectedLength) {
    return res.status(400).json({ error: 'Unsupported country code' });
  }

  // Remove non-digit characters from phone number for length check
  const digitsOnlyPhone = phone.replace(/\D/g, '');

  if (digitsOnlyPhone.length !== expectedLength) {
    return res.status(400).json({ error: `Phone number must be exactly ${expectedLength} digits for country code ${countryCode}` });
  }

  try {
    let transporter;
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      // Use real email service
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    } else {
      // Use Ethereal test account for development
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

    // Email options
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

    // Send email
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

// Start server
const PORT = process.env.PORT || 5000;
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
