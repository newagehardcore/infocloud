const axios = require('axios');

// Configuration
const MINIFLUX_URL = 'http://localhost:8080';
const MINIFLUX_USERNAME = 'admin';
const MINIFLUX_PASSWORD = 'adminpass';

// Miniflux client with authentication
const client = axios.create({
  baseURL: MINIFLUX_URL,
  auth: {
    username: MINIFLUX_USERNAME,
    password: MINIFLUX_PASSWORD
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

// Helper to handle API errors
function logApiError(error, action) {
  console.error(`× Error ${action}:`, error.message);
  if (error.response) {
    console.error(`  Status: ${error.response.status}`);
    if (error.response.data) {
      console.error(`  Data:`, error.response.data);
    }
  }
}

// Get all feeds
async function getFeeds() {
  try {
    const response = await client.get('/v1/feeds');
    return response.data;
  } catch (error) {
    logApiError(error, 'fetching feeds');
    return [];
  }
}

// Refresh a single feed
async function refreshFeed(feedId) {
  try {
    await client.put(`/v1/feeds/${feedId}/refresh`);
    return true;
  } catch (error) {
    logApiError(error, `refreshing feed ${feedId}`);
    return false;
  }
}

// Refresh all feeds
async function refreshAllFeeds() {
  console.log('========== REFRESHING ALL FEEDS ==========');
  const feeds = await getFeeds();
  console.log(`Found ${feeds.length} feeds to refresh`);
  
  let successful = 0;
  let failed = 0;
  
  for (const feed of feeds) {
    process.stdout.write(`Refreshing feed: ${feed.title} (ID: ${feed.id})... `);
    const result = await refreshFeed(feed.id);
    
    if (result) {
      console.log('✓');
      successful++;
    } else {
      console.log('×');
      failed++;
    }
  }
  
  console.log('\n========== REFRESH SUMMARY ==========');
  console.log(`Total feeds: ${feeds.length}`);
  console.log(`Successfully refreshed: ${successful}`);
  console.log(`Failed to refresh: ${failed}`);
  console.log('=====================================');
}

// Run the refresh
refreshAllFeeds().catch(error => {
  console.error('Fatal error:', error);
});
