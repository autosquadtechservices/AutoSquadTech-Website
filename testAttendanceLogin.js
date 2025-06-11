const fetch = require('node-fetch');

async function testAttendanceLogin() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywiZW1haWwiOiJlbXBsb3llZUBleGFtcGxlLmNvbSIsInJvbGUiOiJlbXBsb3llZSIsImlhdCI6MTc0OTYyNzc0NCwiZXhwIjoxNzQ5NjMxMzQ0fQ.tV8EE-ZfVhqS1cHLTgbS-m8BCsx6e9UDyH9W4D3xnf4'; // Employee token

  try {
    const response = await fetch('http://localhost:5000/api/attendance/login', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('Attendance login response:', data);
  } catch (error) {
    console.error('Error testing attendance login:', error);
  }
}

testAttendanceLogin();
