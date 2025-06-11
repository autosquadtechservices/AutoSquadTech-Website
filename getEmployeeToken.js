const fetch = require('node-fetch');

async function getEmployeeToken() {
  try {
    const response = await fetch('http://localhost:5000/api/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'employee@example.com',
        password: 'employee123',
      }),
    });

    const data = await response.json();
    if (data.token) {
      console.log('Employee JWT Token:', data.token);
    } else {
      console.error('Failed to get employee token:', data);
    }
  } catch (error) {
    console.error('Error fetching employee token:', error);
  }
}

getEmployeeToken();
