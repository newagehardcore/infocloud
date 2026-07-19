const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const { getDB } = require('../config/db');
const { processNewsKeywords } = require('../services/wordProcessingService');

// Path to feeds.json containing the bias mapping
const FEEDS_JSON_PATH = path.join(__dirname, '../../data/feeds.json');

// Miniflux configuration
const MINIFLUX_URL = process.env.MINIFLUX_URL || 'http://localhost:8080';
const MINIFLUX_API_KEY = process.env.MINIFLUX_API_KEY || '';
const MINIFLUX_USERNAME = process.env.MINIFLUX_USERNAME || 'admin';
const MINIFLUX_PASSWORD = process.env.MINIFLUX_PASSWORD || 'adminpass';

// Miniflux API client
const minifluxClient = axios.create({
  baseURL: MINIFLUX_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  auth: {
    username: MINIFLUX_USERNAME,
    password: MINIFLUX_PASSWORD
  }
});

// Load bias mapping from feeds.json
async function loadBiasMapping() {
  try {
    const data = await fs.readFile(FEEDS_JSON_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load bias mapping:', error.message);
    return {};
  }
}

// Function to authenticate and get API key if not provided
async function getAuthToken() {
  if (MINIFLUX_API_KEY) {
    minifluxClient.defaults.headers.common['X-Auth-Token'] = MINIFLUX_API_KEY;
    return MINIFLUX_API_KEY;
  }

  try {
    // Use basic authentication for Miniflux API
    const authString = Buffer.from(`${MINIFLUX_USERNAME}:${MINIFLUX_PASSWORD}`).toString('base64');
    minifluxClient.defaults.headers.common['Authorization'] = `Basic ${authString}`;
    
    // Try to make a simple API call to verify credentials
    await minifluxClient.get('/v1/me');
    
    return 'using-basic-auth';
  } catch (error) {
    console.error('Failed to authenticate with Miniflux:', error.message);
    throw error;
  }
}

// Map Miniflux entry to NewsItem format with bias information
async function mapMinifluxEntryToNewsItem(entry, biasMap) {
  try {
    // Find feed in bias mapping
    const feedBias = biasMap[entry.feed.feed_url] || { bias: 'Unknown' };
    
    // Create NewsItem object
    const newsItem = {
      id: `miniflux-${entry.id}`,
      title: entry.title,
      description: entry.content, // Miniflux provides the full content
      url: entry.url,
      source: {
        name: entry.feed.title,
        bias: feedBias.bias,
      },
      publishedAt: new Date(entry.published_at).toISOString(),
      category: entry.feed.category.title,
      keywords: [], // Will be populated later
      createdAt: new Date()
    };

    return newsItem;
  } catch (error) {
    console.error(`Error mapping Miniflux entry to NewsItem:`, error);
    return null;
  }
}

// Fetch unread entries from Miniflux and map them to NewsItems
async function fetchUnreadEntries() {
  try {
    await getAuthToken();
    
    // Load bias mapping
    const biasMap = await loadBiasMapping();
    
    // Get unread entries from Miniflux
    const response = await minifluxClient.get('/v1/entries', {
      params: {
        status: 'unread',
        limit: 100, // Adjust as needed
        order: 'published_at',
        direction: 'desc'
      }
    });
    
    const entries = response.data.entries || [];
    console.log(`[Miniflux] Fetched ${entries.length} unread entries`);
    
    // Map entries to NewsItems and add keywords
    const newsItems = await Promise.all(
      entries.map(entry => mapMinifluxEntryToNewsItem(entry, biasMap))
    );
    
    // Filter out null entries
    const validNewsItems = newsItems.filter(item => item !== null);
    
    // Mark entries as read in Miniflux
    if (entries.length > 0) {
      const entryIds = entries.map(entry => entry.id);
      await minifluxClient.put('/v1/entries', {
        entry_ids: entryIds,
        status: 'read'
      });
      console.log(`[Miniflux] Marked ${entryIds.length} entries as read`);
    }
    
    return validNewsItems;
  } catch (error) {
    console.error('[Miniflux] Error fetching unread entries:', error.message);
    return [];
  }
}

// Main function to fetch news and save to database
async function fetchAllNews() {
  try {
    console.log('[Miniflux] Starting news fetch from Miniflux');
    
    // Get database connection
    const db = getDB();
    const newsCollection = db.collection('newsitems');
    
    // Fetch news items from Miniflux
    const newsItems = await fetchUnreadEntries();
    
    // Insert news items into database
    if (newsItems.length > 0) {
      const result = await newsCollection.insertMany(newsItems);
      console.log(`[Miniflux] Inserted ${result.insertedCount} news items into database`);
    } else {
      console.log('[Miniflux] No new items to insert');
    }
    
    return newsItems;
  } catch (error) {
    console.error('[Miniflux] Error in fetchAllNews:', error.message);
    return [];
  }
}

// Function to refresh feeds (trigger fetching in Miniflux)
async function refreshFeeds() {
  try {
    await getAuthToken();
    
    // Get all feeds
    const response = await minifluxClient.get('/v1/feeds');
    const feeds = response.data;
    
    // Refresh each feed
    for (const feed of feeds) {
      console.log(`[Miniflux] Refreshing feed: ${feed.title}`);
      await minifluxClient.put(`/v1/feeds/${feed.id}/refresh`);
    }
    
    console.log('[Miniflux] All feeds refresh triggered');
  } catch (error) {
    console.error('[Miniflux] Error refreshing feeds:', error.message);
  }
}

module.exports = {
  fetchAllNews,
  refreshFeeds,
  minifluxClient,
  getAuthToken,
};
