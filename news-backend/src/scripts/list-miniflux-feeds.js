require('dotenv').config();
const axios = require('axios');

// Miniflux API configuration
const MINIFLUX_URL = process.env.MINIFLUX_URL || 'http://localhost:8080';
const MINIFLUX_API_KEY = process.env.MINIFLUX_API_KEY;

async function listFeeds() {
  try {
    console.log(`Connecting to Miniflux at ${MINIFLUX_URL}`);
    const response = await axios.get(`${MINIFLUX_URL}/v1/feeds`, {
      headers: {
        'X-Auth-Token': MINIFLUX_API_KEY
      }
    });
    
    console.log(`Found ${response.data.length} feeds in Miniflux.`);
    console.log('\nSample of feeds:');
    response.data.slice(0, 20).forEach(feed => {
      console.log(`ID: ${feed.id}, URL: ${feed.feed_url}, Category: ${feed.category?.title || 'None'}`);
    });

    // Look for feeds that might match our problematic sources
    const problemFeeds = [
      'huffpost',
      'washington',
      'guardian',
      'ft.com',
      'investopedia',
      'gizmodo',
      'realclimate',
      'outkick',
      'breitbart',
      'greencar',
      'deepmind',
      'nasa',
      'businessoffashion',
      'whowhatwear'
    ];

    console.log('\nPossible matches for problematic feeds:');
    response.data.forEach(feed => {
      const url = feed.feed_url.toLowerCase();
      const matchingKeyword = problemFeeds.find(keyword => url.includes(keyword));
      if (matchingKeyword) {
        console.log(`Keyword "${matchingKeyword}" matched:`);
        console.log(`ID: ${feed.id}, URL: ${feed.feed_url}, Category: ${feed.category?.title || 'None'}\n`);
      }
    });
    
  } catch (error) {
    console.error(`Error listing feeds: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

listFeeds(); 