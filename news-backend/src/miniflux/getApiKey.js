const axios = require('axios');

async function getApiKey() {
  try {
    console.log('Fetching user information...');
    // First, get the user ID
    const meResponse = await axios.get(
      'http://localhost:8080/v1/me',
      {
        auth: {
          username: 'admin',
          password: 'adminpass'
        }
      }
    );
    
    const userId = meResponse.data.id;
    console.log(`User ID: ${userId}`);
    
    // Use Basic Auth for initial authentication
    const response = await axios.post(
      `http://localhost:8080/v1/users/${userId}/api_keys`,
      { description: 'INFOCLOUD Integration' },
      {
        auth: {
          username: 'admin',
          password: 'adminpass'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('===== Miniflux API Key =====');
    console.log('API Key:', response.data.api_key);
    console.log('Add this to your .env file as MINIFLUX_API_KEY=your_key_here');
    console.log('===========================');
    
    return response.data.api_key;
  } catch (error) {
    console.error('Error getting API key:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

getApiKey();
