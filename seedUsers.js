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

async function seedUsers() {
  try {
    const users = [
      { email: 'admin@example.com', password: 'AdminPass123', role: 'admin' },
      { email: 'employee@example.com', password: 'EmployeePass123', role: 'employee' },
    ];

    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const user = new User({
          email: userData.email,
          password: hashedPassword,
          role: userData.role,
        });
        await user.save();
        console.log(`Created user: ${userData.email} with role ${userData.role}`);
      } else {
        console.log(`User already exists: ${userData.email}`);
      }
    }

    console.log('Seeding complete.');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding users:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

seedUsers();
