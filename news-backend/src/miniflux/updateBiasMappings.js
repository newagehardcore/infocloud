const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const { rssSources } = require('../services/rssService');

// Configuration
const MINIFLUX_URL = 'http://localhost:8080';
const MINIFLUX_USERNAME = 'admin';
const MINIFLUX_PASSWORD = 'adminpass';
const FEEDS_JSON_PATH = path.join(__dirname, '../../data/feeds.json');

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

// Get all feeds from Miniflux
async function getAllFeeds() {
  try {
    const response = await client.get('/v1/feeds');
    return response.data;
  } catch (error) {
    logApiError(error, 'fetching feeds');
    return [];
  }
}

// Main function to update bias mappings
async function updateBiasMappings() {
  try {
    console.log('========== UPDATING BIAS MAPPINGS ==========');
    
    // Step 1: Get all feeds from Miniflux
    console.log('Fetching feeds from Miniflux...');
    const minifluxFeeds = await getAllFeeds();
    console.log(`Found ${minifluxFeeds.length} feeds in Miniflux`);
    
    // Step 2: Create bias mappings
    const biasMappings = {};
    let matchedCount = 0;
    let unmatchedCount = 0;
    
    minifluxFeeds.forEach(minifluxFeed => {
      const feedUrl = minifluxFeed.feed_url;
      
      // Find matching RSS source by URL
      const matchingSource = rssSources.find(source => source.url === feedUrl);
      
      if (matchingSource) {
        // Add to mappings with feed URL as key
        biasMappings[feedUrl] = {
          bias: matchingSource.bias,
          name: matchingSource.name,
          category: matchingSource.category,
          id: minifluxFeed.id
        };
        matchedCount++;
      } else {
        // Try to find a partial match or similar URL
        const similarSource = rssSources.find(source => 
          source.url.includes(new URL(feedUrl).hostname) || 
          feedUrl.includes(new URL(source.url).hostname)
        );
        
        if (similarSource) {
          biasMappings[feedUrl] = {
            bias: similarSource.bias,
            name: minifluxFeed.title,
            category: similarSource.category,
            id: minifluxFeed.id,
            note: 'Matched by similar URL'
          };
          matchedCount++;
        } else {
          // Add with Unknown bias if no match found
          biasMappings[feedUrl] = {
            bias: 'Unknown',
            name: minifluxFeed.title,
            category: 'News',
            id: minifluxFeed.id,
            note: 'No matching source found'
          };
          unmatchedCount++;
        }
      }
    });
    
    // Step 3: Save mappings to file
    await fs.writeFile(FEEDS_JSON_PATH, JSON.stringify(biasMappings, null, 2), 'utf8');
    
    console.log(`
========== BIAS MAPPING SUMMARY ==========
Total feeds processed: ${minifluxFeeds.length}
Feeds with bias mapping: ${matchedCount}
Feeds without matching source: ${unmatchedCount}
Mappings saved to: ${FEEDS_JSON_PATH}
==========================================
    `);
    
    return biasMappings;
  } catch (error) {
    console.error('Error updating bias mappings:', error);
    throw error;
  }
}

// Run the script
updateBiasMappings().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
