require('dotenv').config();
const axios = require('axios');

// Miniflux API configuration
const MINIFLUX_URL = process.env.MINIFLUX_URL || 'http://localhost:8080';
const MINIFLUX_API_KEY = process.env.MINIFLUX_API_KEY;

async function searchForInvestopediaFeed() {
  try {
    console.log(`Connecting to Miniflux at ${MINIFLUX_URL}`);
    const response = await axios.get(`${MINIFLUX_URL}/v1/feeds`, {
      headers: {
        'X-Auth-Token': MINIFLUX_API_KEY
      }
    });
    
    console.log(`Found ${response.data.length} feeds in Miniflux.`);
    
    // Look for feeds with "invest" in the URL
    const investFeeds = response.data.filter(feed => 
      feed.feed_url.toLowerCase().includes('invest') || 
      feed.site_url?.toLowerCase().includes('invest') ||
      feed.title?.toLowerCase().includes('invest')
    );
    
    console.log(`\nFound ${investFeeds.length} feeds matching "invest":`);
    investFeeds.forEach(feed => {
      console.log(`ID: ${feed.id}`);
      console.log(`Title: ${feed.title}`);
      console.log(`Feed URL: ${feed.feed_url}`);
      console.log(`Site URL: ${feed.site_url}`);
      console.log(`Category: ${feed.category?.title || 'None'}`);
      console.log('');
    });
    
    // Also look for feeds in the ECONOMICS category that might be relevant
    const economicsFeeds = response.data.filter(feed => 
      feed.category?.title?.toUpperCase() === 'ECONOMICS' && 
      !feed.feed_url.toLowerCase().includes('invest')
    );
    
    console.log(`\nFound ${economicsFeeds.length} other feeds in the ECONOMICS category:`);
    economicsFeeds.forEach(feed => {
      console.log(`ID: ${feed.id}`);
      console.log(`Title: ${feed.title}`);
      console.log(`Feed URL: ${feed.feed_url}`);
      console.log(`Category: ${feed.category?.title || 'None'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error(`Error searching feeds: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

searchForInvestopediaFeed(); 