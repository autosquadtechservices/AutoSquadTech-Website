const fetch = require('node-fetch');

async function getToken() {
  try {
    const response = await fetch('http://localhost:5000/api/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123',
      }),
    });

    const data = await response.json();
    if (data.token) {
      console.log('JWT Token:', data.token);
    } else {
      console.error('Failed to get token:', data);
    }
  } catch (error) {
    console.error('Error fetching token:', error);
  }
}

getToken();
