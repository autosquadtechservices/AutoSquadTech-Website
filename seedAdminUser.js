require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autosquad', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

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
});

const User = mongoose.model('User', userSchema);

async function createAdminUser() {
  const email = 'admin@example.com';
  const password = await bcrypt.hash('admin123', 10);
  const existingUser = await User.findOne({ email });
  if (!existingUser) {
    const user = new User({ email, password, role: 'admin' });
    await user.save();
    console.log('Admin user created:', email);
  } else {
    console.log('Admin user already exists:', email);
  }
  mongoose.connection.close();
}

createAdminUser();
