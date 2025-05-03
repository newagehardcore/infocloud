const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config(); // Load environment variables
const { getDB } = require('../config/db');
const { processNewsKeywords } = require('../services/wordProcessingService');

// Configuration from environment variables
const MINIFLUX_URL = process.env.MINIFLUX_URL || 'http://localhost:8080';
const MINIFLUX_USERNAME = process.env.MINIFLUX_USERNAME || 'admin';
const MINIFLUX_PASSWORD = process.env.MINIFLUX_PASSWORD || 'adminpass';
const MINIFLUX_API_KEY = process.env.MINIFLUX_API_KEY;
const FEEDS_JSON_PATH = path.join(__dirname, '../../data/feeds.json');

// Miniflux client with authentication
const client = axios.create({
  baseURL: MINIFLUX_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Auth-Token': MINIFLUX_API_KEY
  }
});

// Fallback to basic auth if API key is not available
if (!MINIFLUX_API_KEY) {
  console.log('API key not found, falling back to basic authentication');
  client.defaults.auth = {
    username: MINIFLUX_USERNAME,
    password: MINIFLUX_PASSWORD
  };
}

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

// Load bias mapping
async function loadBiasMapping() {
  try {
    const data = await fs.readFile(FEEDS_JSON_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading bias mapping: ${error.message}`);
    return {};
  }
}

// Get RECENT entries (modified from unread)
async function getRecentEntries(limit = 100, daysAgo = 7) { // Renamed & added daysAgo
  try {
    // Calculate date for X days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - daysAgo);
    const afterTimestamp = Math.floor(pastDate.getTime() / 1000); // Miniflux uses Unix timestamp

    console.log(`Fetching all entries since ${pastDate.toISOString()} (last ${daysAgo} days).`);

    const response = await client.get('/v1/entries', {
      params: {
        // status: 'unread', // REMOVED: Don't filter by Miniflux status
        limit: limit,
        direction: 'desc',
        after: afterTimestamp // ADDED: Filter by time instead
      }
    });
    
    return response.data.entries || [];
  } catch (error) {
    logApiError(error, 'fetching recent entries');
    return [];
  }
}

// Map Miniflux entry to INFOCLOUD news item format
async function mapEntryToNewsItem(entry, biasMap, feedIdMap) {
  try {
    // Try to find bias information by feed URL or feed ID
    let bias = 'Unknown';
    let category = entry.feed.category ? entry.feed.category.title : 'News';
    
    // First try direct feed URL match
    if (biasMap[entry.feed.feed_url]) {
      bias = biasMap[entry.feed.feed_url].bias;
    } 
    // Then try with feed ID
    else if (feedIdMap && feedIdMap[entry.feed.id]) {
      bias = feedIdMap[entry.feed.id].bias;
    }
    
    // Create news item
    const newsItem = {
      id: `miniflux-${entry.id}`,
      title: entry.title || 'No title',
      description: entry.content || entry.summary || 'No content', // Use full content or summary
      url: entry.url,
      source: {
        name: entry.feed.title,
        bias: bias
      },
      publishedAt: new Date(entry.published_at).toISOString(),
      category: category,
      keywords: [], // Will be populated via NLP processing
      createdAt: new Date()
    };
    
    return newsItem;
  } catch (error) {
    console.error(`Error mapping entry to news item: ${error.message}`);
    return null;
  }
}

// Create a feed ID to bias mapping from the URL-based bias mapping
function createFeedIdBiasMap(biasMap) {
  const feedIdMap = {};
  
  for (const [url, data] of Object.entries(biasMap)) {
    if (data.id) {
      feedIdMap[data.id] = {
        bias: data.bias,
        name: data.name,
        category: data.category
      };
    }
  }
  
  return feedIdMap;
}

// Main function to fetch news
async function fetchNews() {
  console.log('========== FETCHING NEWS FROM MINIFLUX ==========');
  
  // Load bias mapping
  const biasMap = await loadBiasMapping();
  
  // Create feed ID to bias mapping for easier lookups
  const feedIdMap = createFeedIdBiasMap(biasMap);
  
  // Get database connection
  const db = getDB();
  const newsCollection = db.collection('newsitems');
  
  // Get RECENT entries from Miniflux
  console.log('Fetching recent entries...');
  const entries = await getRecentEntries(1000, 7); // Fetch last 7 days, increased limit
  console.log(`Found ${entries.length} entries from Miniflux in the time window.`);
  
  // Process entries
  console.log('Processing and checking for existing entries...');
  const itemsToInsert = [];
  const allFetchedItems = []; // <-- Store ALL valid items found
  let checkedCount = 0;
  let existCount = 0;
  
  for (const entry of entries) {
    const newsItem = await mapEntryToNewsItem(entry, biasMap, feedIdMap);
    if (newsItem) {
      allFetchedItems.push(newsItem); // <-- Add to the list of all items
      checkedCount++;
      // Check if item already exists in DB by its unique ID
      const existingItem = await newsCollection.findOne({ id: newsItem.id });
      if (!existingItem) {
        itemsToInsert.push(newsItem);
      } else {
        existCount++;
      }
    }
  }
  console.log(`Checked ${checkedCount} valid entries. ${existCount} already exist in DB. ${itemsToInsert.length} are new.`);
  
  // Save ONLY NEW news items to database
  if (itemsToInsert.length > 0) {
    try {
      const result = await newsCollection.insertMany(itemsToInsert);
      console.log(`Successfully inserted ${result.insertedCount} NEW news items into database`);
    } catch (error) {
      console.error(`Error inserting news items: ${error.message}`);
    }
  } else {
    console.log('No new news items to insert');
  }
  
  // REMOVED: Don't mark entries as read in Miniflux
  /*
  if (entryIds.length > 0) {
    console.log(`Marking ${entryIds.length} entries as read`);
    await markEntriesAsRead(entryIds);
  }
  */
  
  console.log('\n========== FETCH SUMMARY ==========');
  console.log(`Total entries fetched from time window: ${entries.length}`);
  console.log(`New news items inserted: ${itemsToInsert.length}`);
  console.log('===================================');
  
  // Return ALL valid fetched items so cron can process them all
  return allFetchedItems; 
}

// If this file is run directly
if (require.main === module) {
  fetchNews().catch(error => {
    console.error('Fatal error:', error);
  });
}

// Export the function for use in other modules
module.exports = {
  fetchNews,
  loadBiasMapping,
  // getUnreadEntries, // Removed export
  // markEntriesAsRead // Removed export
  getRecentEntries // Export new function if needed elsewhere
};
