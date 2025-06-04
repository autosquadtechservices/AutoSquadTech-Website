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

async function createAdminUser() {
  await sequelize.sync();
  const email = 'admin@example.com';
  const password = await bcrypt.hash('admin123', 10);
  const [user, created] = await User.findOrCreate({
    where: { email },
    defaults: { password, role: 'admin' },
  });
  if (created) {
    console.log('Admin user created:', email);
  } else {
    console.log('Admin user already exists:', email);
  }
  await sequelize.close();
}

createAdminUser();
