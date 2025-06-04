require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('employee', 'admin'),
    allowNull: false,
    defaultValue: 'employee',
  },
});

async function seedUsers() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    await sequelize.sync();

    const users = [
      { email: 'admin@example.com', password: 'AdminPass123', role: 'admin' },
      { email: 'employee@example.com', password: 'EmployeePass123', role: 'employee' },
    ];

    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const [user, created] = await User.findOrCreate({
        where: { email: userData.email },
        defaults: {
          password: hashedPassword,
          role: userData.role,
        },
      });
      if (created) {
        console.log(`Created user: ${userData.email} with role ${userData.role}`);
      } else {
        console.log(`User already exists: ${userData.email}`);
      }
    }

    console.log('Seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
}

seedUsers();
