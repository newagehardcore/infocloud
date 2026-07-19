const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const { rssSources } = require('../services/rssService');

const MINIFLUX_URL = 'http://localhost:8080';
const MINIFLUX_USERNAME = 'admin';
const MINIFLUX_PASSWORD = 'adminpass';
const FEEDS_JSON_PATH = path.join(__dirname, '../../data/feeds.json');

// Simple function to check if Miniflux is running
async function checkMiniflux() {
  try {
    const response = await axios.get(`${MINIFLUX_URL}/healthcheck`);
    if (response.data === 'OK') {
      console.log('✓ Miniflux is running correctly!');
      return true;
    }
    console.error('× Miniflux returned unexpected response:', response.data);
    return false;
  } catch (error) {
    console.error('× Error checking Miniflux health:', error.message);
    return false;
  }
}

// Get or create a category
async function getOrCreateCategory(name) {
  try {
    // Get all categories
    const response = await axios.get(`${MINIFLUX_URL}/v1/categories`, {
      auth: {
        username: MINIFLUX_USERNAME,
        password: MINIFLUX_PASSWORD
      }
    });
    
    // Look for our category
    const existingCategory = response.data.find(category => 
      category.title.toLowerCase() === name.toLowerCase()
    );
    
    if (existingCategory) {
      console.log(`→ Using existing category: ${name} (ID: ${existingCategory.id})`);
      return existingCategory.id;
    }
    
    // Create new category
    const createResponse = await axios.post(
      `${MINIFLUX_URL}/v1/categories`,
      { title: name },
      {
        auth: {
          username: MINIFLUX_USERNAME,
          password: MINIFLUX_PASSWORD
        }
      }
    );
    
    console.log(`+ Created new category: ${name} (ID: ${createResponse.data.id})`);
    return createResponse.data.id;
  } catch (error) {
    console.error(`× Error getting/creating category "${name}":`, error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
    throw error;
  }
}

// Add a feed to Miniflux
async function addFeed(url, categoryId, title) {
  try {
    const response = await axios.post(
      `${MINIFLUX_URL}/v1/feeds`,
      {
        feed_url: url,
        category_id: categoryId,
        title: title,
        crawler: true
      },
      {
        auth: {
          username: MINIFLUX_USERNAME,
          password: MINIFLUX_PASSWORD
        }
      }
    );
    
    console.log(`+ Added feed: ${title} (ID: ${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error(`× Error adding feed "${title}":`, error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    }
    return null;
  }
}

// Main setup function
async function setup() {
  console.log('========== INFOCLOUD MINIFLUX SETUP ==========');
  
  // Check if Miniflux is running
  const isRunning = await checkMiniflux();
  if (!isRunning) {
    console.error('Miniflux is not running. Please start the containers first.');
    return;
  }
  
  // Prepare bias mapping
  const biasMap = {};
  
  // Get unique categories from RSS sources
  const uniqueCategories = [...new Set(rssSources.map(source => source.category))];
  console.log(`Found ${uniqueCategories.length} unique categories`);
  
  // Create categories and process feeds (limit to 10 for testing)
  const testSources = rssSources.slice(0, 10); 
  
  for (const category of uniqueCategories) {
    try {
      // Get or create category
      const categoryId = await getOrCreateCategory(category);
      
      // Add feeds for this category
      const categoryFeeds = testSources.filter(source => source.category === category);
      console.log(`Processing ${categoryFeeds.length} feeds for category "${category}"...`);
      
      for (const feed of categoryFeeds) {
        const result = await addFeed(feed.url, categoryId, feed.name);
        if (result) {
          // Store the feed URL directly from our source since Miniflux might normalize it
          biasMap[feed.url] = {
            bias: feed.bias,
            id: result.id,
            name: feed.name
          };
          console.log(`  Added to bias mapping: ${feed.name} (${feed.bias})`);
        }
      }
    } catch (error) {
      console.error(`Error processing category "${category}":`, error.message);
    }
  }
  
  // Save bias mapping
  try {
    await fs.writeFile(FEEDS_JSON_PATH, JSON.stringify(biasMap, null, 2));
    console.log(`✓ Bias mapping saved to ${FEEDS_JSON_PATH}`);
  } catch (error) {
    console.error('× Error saving bias mapping:', error.message);
  }
  
  console.log('========== SETUP COMPLETE ==========');
}

// Run the setup
setup();
