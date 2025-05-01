const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const { PoliticalBias } = require('../types');

// Import rss sources with bias information
const { rssSources } = require('../services/rssService');

// Miniflux configuration
const MINIFLUX_URL = process.env.MINIFLUX_URL || 'http://localhost:8080';
const MINIFLUX_API_KEY = process.env.MINIFLUX_API_KEY || '';
const MINIFLUX_USERNAME = process.env.MINIFLUX_USERNAME || 'admin';
const MINIFLUX_PASSWORD = process.env.MINIFLUX_PASSWORD || 'adminpass';
const FEEDS_JSON_PATH = path.join(__dirname, '../../data/feeds.json');

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

// Function to create a category in Miniflux
async function createCategory(title) {
  try {
    const response = await minifluxClient.post('/v1/categories', { title });
    return response.data;
  } catch (error) {
    console.error(`Failed to create category "${title}":`, error.message);
    throw error;
  }
}

// Function to add a feed to Miniflux
async function addFeed(feedUrl, categoryId, title) {
  try {
    const response = await minifluxClient.post('/v1/feeds', {
      feed_url: feedUrl,
      category_id: categoryId,
      title: title,
      crawler: true,
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to add feed "${title}" (${feedUrl}):`, error.message);
    if (error.response && error.response.data) {
      console.error('Response data:', error.response.data);
    }
    return null; // Return null instead of throwing to continue with other feeds
  }
}

// Function to remove all existing feeds and categories
async function cleanMiniflux() {
  try {
    // Get all feeds
    const feedsResponse = await minifluxClient.get('/v1/feeds');
    const feeds = feedsResponse.data;

    // Delete each feed
    for (const feed of feeds) {
      console.log(`Deleting feed: ${feed.title}`);
      await minifluxClient.delete(`/v1/feeds/${feed.id}`);
    }

    // Get all categories
    const categoriesResponse = await minifluxClient.get('/v1/categories');
    const categories = categoriesResponse.data;

    // Delete each category
    for (const category of categories) {
      console.log(`Deleting category: ${category.title}`);
      await minifluxClient.delete(`/v1/categories/${category.id}`);
    }

    console.log('Successfully removed all feeds and categories from Miniflux');
  } catch (error) {
    console.error('Failed to clean Miniflux:', error.message);
    throw error;
  }
}

// Function to save bias mapping to JSON file
async function saveBiasMapping(biasMap) {
  try {
    await fs.writeFile(FEEDS_JSON_PATH, JSON.stringify(biasMap, null, 2));
    console.log(`Bias mapping saved to ${FEEDS_JSON_PATH}`);
  } catch (error) {
    console.error('Failed to save bias mapping:', error.message);
    throw error;
  }
}

// Main function to set up Miniflux with all feeds
async function setupMiniflux() {
  try {
    // Authenticate with Miniflux
    await getAuthToken();
    console.log('Successfully authenticated with Miniflux');

    // Clean existing feeds and categories
    await cleanMiniflux();

    // Create categories based on unique topics in rssSources
    const uniqueCategories = [...new Set(rssSources.map(source => source.category))];
    const categoryMap = {};
    const biasMap = {};

    for (const category of uniqueCategories) {
      console.log(`Creating category: ${category}`);
      const createdCategory = await createCategory(category);
      categoryMap[category] = createdCategory.id;
    }

    // Add feeds to Miniflux and maintain bias mapping
    for (const source of rssSources) {
      console.log(`Adding feed: ${source.name} (${source.url})`);
      const categoryId = categoryMap[source.category];
      const feed = await addFeed(source.url, categoryId, source.name);
      
      if (feed) {
        // Store the feed ID and bias in the mapping
        biasMap[feed.feed_url] = { 
          bias: source.bias,
          id: feed.id,
          name: source.name
        };
        console.log(`Added feed: ${source.name} (ID: ${feed.id})`);
      }
    }

    // Save bias mapping to JSON file
    await saveBiasMapping(biasMap);

    console.log('Miniflux setup completed successfully');
  } catch (error) {
    console.error('Miniflux setup failed:', error.message);
  }
}

// Export functions for use in other files
module.exports = {
  setupMiniflux,
  getAuthToken,
  minifluxClient,
};

// Run the setup function if this file is executed directly
if (require.main === module) {
  setupMiniflux();
}
