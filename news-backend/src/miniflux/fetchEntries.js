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

// Get unread entries
async function getUnreadEntries(limit = 100) {
  try {
    const response = await client.get('/v1/entries', {
      params: {
        status: 'unread',
        limit: limit,
        direction: 'desc'
      }
    });
    
    return response.data.entries || [];
  } catch (error) {
    logApiError(error, 'fetching unread entries');
    return [];
  }
}

// Mark entries as read
async function markEntriesAsRead(entryIds) {
  if (!entryIds.length) return true;
  
  try {
    await client.put('/v1/entries', {
      entry_ids: entryIds,
      status: 'read'
    });
    return true;
  } catch (error) {
    logApiError(error, 'marking entries as read');
    return false;
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
  
  // Get unread entries from Miniflux
  console.log('Fetching unread entries...');
  const entries = await getUnreadEntries(200);
  console.log(`Found ${entries.length} unread entries`);
  
  // Process entries
  console.log('Processing entries...');
  const mappedItems = [];
  const entryIds = [];
  
  for (const entry of entries) {
    const newsItem = await mapEntryToNewsItem(entry, biasMap, feedIdMap);
    if (newsItem) {
      mappedItems.push(newsItem);
      entryIds.push(entry.id);
    }
  }
  
  // Process keywords for all news items at once if we have any
  let newsItems = [];
  if (mappedItems.length > 0) {
    console.log(`Processing keywords for ${mappedItems.length} news items...`);
    try {
      // Extract keywords using the existing word processing service
      const itemsWithKeywords = await processNewsKeywords(mappedItems);
      
      // Ensure we preserve bias information and original data structure
      if (Array.isArray(itemsWithKeywords)) {
        newsItems = itemsWithKeywords.map((processedItem, index) => {
          const originalItem = mappedItems[index];
          
          // If the processed item is valid, merge it with the original item
          // ensuring that bias and source information is preserved
          if (processedItem) {
            return {
              ...originalItem,
              keywords: processedItem.keywords || [],
              // Make sure bias is preserved
              source: {
                ...originalItem.source,
                bias: originalItem.source?.bias || 'Unknown'
              }
            };
          }
          return originalItem;
        });
      } else {
        // Fallback to original items if processing returned invalid format
        newsItems = mappedItems;
        console.error('Keyword processing returned unexpected format');
      }
      
      console.log(`Successfully processed keywords for ${newsItems.length} items`);
    } catch (error) {
      console.error(`Error processing keywords: ${error.message}`);
      // Fallback to the mapped items without keywords
      newsItems = mappedItems;
    }
  }
  
  // Save news items to database
  if (newsItems.length > 0) {
    try {
      const result = await newsCollection.insertMany(newsItems);
      console.log(`Successfully inserted ${result.insertedCount} news items into database`);
    } catch (error) {
      console.error(`Error inserting news items: ${error.message}`);
    }
  } else {
    console.log('No valid news items to insert');
  }
  
  // Mark entries as read
  if (entryIds.length > 0) {
    console.log(`Marking ${entryIds.length} entries as read`);
    await markEntriesAsRead(entryIds);
  }
  
  console.log('\n========== FETCH SUMMARY ==========');
  console.log(`Total entries processed: ${entries.length}`);
  console.log(`Valid news items created: ${newsItems.length}`);
  console.log('===================================');
  
  return newsItems;
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
  getUnreadEntries,
  markEntriesAsRead
};
