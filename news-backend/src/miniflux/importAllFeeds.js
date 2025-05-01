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

// Get all existing categories
async function getCategories() {
  try {
    const response = await client.get('/v1/categories');
    return response.data;
  } catch (error) {
    logApiError(error, 'fetching categories');
    return [];
  }
}

// Create a category
async function createCategory(title) {
  try {
    const response = await client.post('/v1/categories', { title });
    console.log(`+ Created new category: ${title} (ID: ${response.data.id})`);
    return response.data;
  } catch (error) {
    logApiError(error, `creating category "${title}"`);
    return null;
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

// Add a feed
async function addFeed(feedUrl, categoryId, title) {
  try {
    const response = await client.post('/v1/feeds', {
      feed_url: feedUrl,
      category_id: categoryId,
      title: title,
      crawler: true
    });
    console.log(`+ Added feed: ${title} (ID: ${response.data.id})`);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 400 && 
        error.response.data && error.response.data.error_message === 'This feed already exists.') {
      console.log(`! Feed already exists: ${title}`);
      
      // Try to find the existing feed
      const feeds = await getFeeds();
      const existingFeed = feeds.find(f => 
        f.title === title || f.feed_url === feedUrl
      );
      
      if (existingFeed) {
        console.log(`  Found existing feed ID: ${existingFeed.id}`);
        return existingFeed;
      }
    } else {
      logApiError(error, `adding feed "${title}"`);
    }
    return null;
  }
}

// Get all existing feeds and create a mapping of URL to feed ID
async function createFeedUrlToIdMap() {
  const feeds = await getFeeds();
  const urlMap = {};
  
  feeds.forEach(feed => {
    urlMap[feed.feed_url] = feed.id;
  });
  
  return urlMap;
}

// Main function to import all feeds
async function importAllFeeds() {
  console.log('========== IMPORTING ALL FEEDS TO MINIFLUX ==========');
  
  // Get all existing categories
  const categories = await getCategories();
  const categoryMap = {};
  
  // Map existing categories by title
  categories.forEach(category => {
    categoryMap[category.title.toLowerCase()] = category.id;
  });
  
  // Create bias mapping object
  const biasMap = {};
  
  // Track stats
  const stats = {
    totalFeeds: rssSources.length,
    addedFeeds: 0,
    failedFeeds: 0,
    addedCategories: 0
  };
  
  // Process each unique category
  const uniqueCategories = [...new Set(rssSources.map(source => source.category))];
  console.log(`Processing ${uniqueCategories.length} categories and ${rssSources.length} feeds...`);
  
  for (const category of uniqueCategories) {
    console.log(`\n=== Category: ${category} ===`);
    
    // Get or create category
    let categoryId;
    if (categoryMap[category.toLowerCase()]) {
      categoryId = categoryMap[category.toLowerCase()];
      console.log(`→ Using existing category (ID: ${categoryId})`);
    } else {
      const newCategory = await createCategory(category);
      if (newCategory) {
        categoryId = newCategory.id;
        categoryMap[category.toLowerCase()] = categoryId;
        stats.addedCategories++;
      } else {
        console.error(`× Failed to create category: ${category}, skipping feeds in this category`);
        continue;
      }
    }
    
    // Get feeds for this category
    const categoryFeeds = rssSources.filter(source => source.category === category);
    
    // Add each feed
    for (const feed of categoryFeeds) {
      console.log(`\nProcessing feed: ${feed.name} (${feed.url})`);
      
      const result = await addFeed(feed.url, categoryId, feed.name);
      if (result) {
        // Add to bias mapping
        biasMap[feed.url] = {
          bias: feed.bias,
          id: result.id,
          name: feed.name,
          category: category
        };
        stats.addedFeeds++;
      } else {
        console.error(`× Failed to add feed: ${feed.name}`);
        stats.failedFeeds++;
      }
    }
  }
  
  // Save bias mapping
  try {
    await fs.writeFile(FEEDS_JSON_PATH, JSON.stringify(biasMap, null, 2));
    console.log(`\n✓ Bias mapping saved to ${FEEDS_JSON_PATH}`);
  } catch (error) {
    console.error(`\n× Error saving bias mapping: ${error.message}`);
  }
  
  console.log('\n========== IMPORT SUMMARY ==========');
  console.log(`Total feeds processed: ${stats.totalFeeds}`);
  console.log(`Categories created: ${stats.addedCategories}`);
  console.log(`Feeds added/updated: ${stats.addedFeeds}`);
  console.log(`Failed feeds: ${stats.failedFeeds}`);
  console.log('====================================');
}

// Run the import
importAllFeeds().catch(error => {
  console.error('Fatal error:', error);
});
