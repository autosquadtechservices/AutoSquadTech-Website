const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

const users = [
  {
    username: 'adminuser',
    email: 'admin@example.com',
    password: 'AdminPass123',
    role: 'admin',
  },
  {
    username: 'employeeuser',
    email: 'employee@example.com',
    password: 'EmployeePass123',
    role: 'employee',
  },
];

async function seedUsers() {
  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    db.run(
      `INSERT INTO authapp_customuser (username, email, password, role) VALUES (?, ?, ?, ?)`,
      [user.username, user.email, hashedPassword, user.role],
      function (err) {
        if (err) {
          console.error('Error inserting user:', err.message);
        } else {
          console.log(`User ${user.username} inserted successfully.`);
        }
      }
    );
  }
}

seedUsers()
  .then(() => {
    console.log('Seeding complete.');
    db.close();
  })
  .catch((err) => {
    console.error('Seeding failed:', err);
  });
