const axios = require('axios');
// Removed: const fs = require('fs/promises');
const path = require('path');
require('dotenv').config(); // Load environment variables
const { getDB } = require('../config/db');
// The import below might be unused after removing fetchNews and its helpers
// const { processNewsKeywords } = require('../services/wordProcessingService'); 

// Configuration from environment variables
const MINIFLUX_URL = process.env.MINIFLUX_URL || 'http://localhost:8080';
const MINIFLUX_USERNAME = process.env.MINIFLUX_USERNAME || 'admin';
const MINIFLUX_PASSWORD = process.env.MINIFLUX_PASSWORD || 'adminpass';
const MINIFLUX_API_KEY = process.env.MINIFLUX_API_KEY;
// Removed: const FEEDS_JSON_PATH = path.join(__dirname, '../../data/feeds.json');

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

// Removed: loadBiasMapping function
// Removed: mapEntryToNewsItem function
// Removed: createFeedIdBiasMap function
// Removed: fetchNews function

// Get RECENT entries (modified from unread)
async function getRecentEntries(limit = 100, daysAgo = 2) { // Renamed & added daysAgo
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

// Removed: If this file is run directly block for fetchNews

// Export the function for use in other modules
module.exports = {
  // Removed: fetchNews,
  // Removed: loadBiasMapping,
  getRecentEntries // Export new function if needed elsewhere
  // Removed: markEntriesAsRead // This was part of fetchNews logic, ensure it's not needed by getRecentEntries
};
