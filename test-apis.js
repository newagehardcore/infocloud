const axios = require('axios');
require('dotenv').config();

// GNews API test
async function testGNewsAPI() {
  console.log('Testing GNews API...');
  const GNEWS_API_KEY = process.env.REACT_APP_GNEWS_API_KEY;
  
  if (!GNEWS_API_KEY) {
    console.error('No GNews API key found in environment variables');
    return;
  }
  
  console.log(`GNews API key length: ${GNEWS_API_KEY.length}, first/last chars: ${GNEWS_API_KEY.substring(0, 3)}...${GNEWS_API_KEY.substring(GNEWS_API_KEY.length - 3)}`);
  
  try {
    // Try search endpoint (more likely to return results)
    const url = new URL('https://gnews.io/api/v4/search');
    url.searchParams.append('apikey', GNEWS_API_KEY);
    url.searchParams.append('lang', 'en');
    url.searchParams.append('q', 'today');  // Simple query
    url.searchParams.append('max', '5');
    
    console.log(`GNews request URL (key redacted): ${url.toString().replace(GNEWS_API_KEY, 'REDACTED')}`);
    const response = await axios.get(url.toString(), {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'InfoCloud/1.0'
      }
    });
    
    console.log(`GNews API status: ${response.status}`);
    console.log(`GNews API total articles: ${response.data.articles ? response.data.articles.length : 0}`);
    if (response.data.articles && response.data.articles.length > 0) {
      console.log('First article title:', response.data.articles[0].title);
    }
  } catch (error) {
    console.error('GNews API Error:');
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error('Response data:', error.response.data);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
    } else {
      console.error(error);
    }
  }
}

// TheNewsAPI test
async function testTheNewsAPI() {
  console.log('\nTesting TheNewsAPI...');
  const THE_NEWS_API_KEY = process.env.REACT_APP_THE_NEWS_API_KEY;
  
  if (!THE_NEWS_API_KEY) {
    console.error('No TheNewsAPI key found in environment variables');
    return;
  }
  
  console.log(`TheNewsAPI key length: ${THE_NEWS_API_KEY.length}, first/last chars: ${THE_NEWS_API_KEY.substring(0, 3)}...${THE_NEWS_API_KEY.substring(THE_NEWS_API_KEY.length - 3)}`);
  
  try {
    // Try the simplest possible request first
    const url = new URL('https://api.thenewsapi.com/v1/news/all');
    url.searchParams.append('api_token', THE_NEWS_API_KEY);
    url.searchParams.append('limit', '5');
    
    console.log(`TheNewsAPI request URL (key redacted): ${url.toString().replace(THE_NEWS_API_KEY, 'REDACTED')}`);
    const response = await axios.get(url.toString(), {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'InfoCloud/1.0'
      }
    });
    
    console.log(`TheNewsAPI status: ${response.status}`);
    console.log(`TheNewsAPI total articles: ${response.data.data ? response.data.data.length : 0}`);
    if (response.data.data && response.data.data.length > 0) {
      console.log('First article title:', response.data.data[0].title);
    }
  } catch (error) {
    console.error('TheNewsAPI Error:');
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error('Response data:', error.response.data);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
    } else {
      console.error(error);
    }
  }
}

// Run tests
async function runTests() {
  await testGNewsAPI();
  await testTheNewsAPI();
}

runTests(); 