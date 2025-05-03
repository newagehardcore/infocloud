const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') }); // Load .env from root

// --- Configuration (Copied from fetchEntries for standalone use) ---
const MINIFLUX_URL = process.env.MINIFLUX_URL || 'http://localhost:8080';
const MINIFLUX_API_KEY = process.env.MINIFLUX_API_KEY;
const MINIFLUX_USERNAME = process.env.MINIFLUX_USERNAME || 'admin'; // Fallback if no API Key
const MINIFLUX_PASSWORD = process.env.MINIFLUX_PASSWORD || 'adminpass'; // Fallback if no API Key
const FETCH_LIMIT = 5000; // How many recent entries to fetch and mark unread

// --- Miniflux Client Setup ---
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

// --- Helper to log errors ---
function logApiError(error, action) {
  console.error(`× Error ${action}:`, error.message);
  if (error.response) {
    console.error(`  Status: ${error.response.status}`);
    if (error.response.data) {
      console.error(`  Data:`, JSON.stringify(error.response.data));
    }
  }
}

// --- Main Script Logic ---
async function markRecentAsUnread() {
  console.log(`Attempting to mark the last ${FETCH_LIMIT} entries as unread in Miniflux at ${MINIFLUX_URL}...`);

  // 1. Get recent entry IDs
  let entryIds = [];
  try {
    console.log(`Fetching up to ${FETCH_LIMIT} recent entries to get their IDs...`);
    const response = await client.get('/v1/entries', {
      params: {
        limit: FETCH_LIMIT,
        direction: 'desc' // Fetch most recent first
      }
    });
    const entries = response.data.entries || [];
    entryIds = entries.map(entry => entry.id);
    console.log(`Found ${entryIds.length} entry IDs.`);

  } catch (error) {
    logApiError(error, 'fetching recent entry IDs');
    console.error('Cannot proceed without entry IDs.');
    return; // Exit if fetching IDs failed
  }

  if (entryIds.length === 0) {
    console.log('No entries found to mark as unread.');
    return;
  }

  // 2. Mark these entries as unread
  try {
    console.log(`Sending request to mark ${entryIds.length} entries as unread...`);
    await client.put('/v1/entries', {
      entry_ids: entryIds,
      status: 'unread'
    });
    console.log(`✅ Successfully requested to mark ${entryIds.length} entries as unread.`);

  } catch (error) {
    logApiError(error, 'marking entries as unread');
  }
}

// --- Execute the script ---
markRecentAsUnread(); 