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

// Function to authenticate and set API key if provided
async function setAuthHeader() {
  if (MINIFLUX_API_KEY) {
    minifluxClient.defaults.headers.common['X-Auth-Token'] = MINIFLUX_API_KEY;
    console.log('Using API Key for authentication.');
  } else {
    // Basic auth is set by default in axios.create, log if using it
    console.log('API key not found, using basic authentication.');
  }
}

// Function to get or create a category in Miniflux
async function getOrCreateCategory(title, existingCategoriesMap) {
  const lowerCaseTitle = title.toLowerCase();
  if (existingCategoriesMap.has(lowerCaseTitle)) {
    console.log(`→ Using existing category: ${title} (ID: ${existingCategoriesMap.get(lowerCaseTitle).id})`);
    return existingCategoriesMap.get(lowerCaseTitle).id;
  }

  try {
    console.log(`Creating category: ${title}`);
    const response = await minifluxClient.post('/v1/categories', { title });
    // Add newly created category to the map to avoid duplicates in this run
    existingCategoriesMap.set(lowerCaseTitle, response.data);
    return response.data.id;
  } catch (error) {
    // Handle potential conflict if category was created concurrently (though unlikely in script)
    if (error.response && error.response.status === 409) {
       console.warn(`Category "${title}" likely already exists (conflict error). Attempting to refetch.`);
       // Refetch categories and try to find it
       const categories = await fetchExistingCategories();
       const foundCategory = categories.find(cat => cat.title.toLowerCase() === lowerCaseTitle);
       if (foundCategory) {
         console.log(`→ Found category after conflict: ${title} (ID: ${foundCategory.id})`);
         return foundCategory.id;
       }
    }
    console.error(`× Failed to create category "${title}":`, error.message);
    // Decide if we should throw or return null/undefined
    // Returning null allows the script to continue with other categories/feeds
    return null; 
  }
}

// Function to add a feed to Miniflux
async function addFeed(feedUrl, categoryId, title) {
  try {
    const response = await minifluxClient.post('/v1/feeds', {
      feed_url: feedUrl,
      category_id: categoryId,
      title: title,
      crawler: true, // Ensure crawler is enabled
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });
    console.log(`+ Added feed: ${title} (ID: ${response.data.id})`);
    return response.data; // Return the created feed object (contains id)
  } catch (error) {
    // Check for conflict (feed already exists)
    if (error.response && error.response.status === 409) {
      console.warn(`-> Feed "${title}" (${feedUrl}) already exists.`);
      // We need the ID for the bias map, try to discover it
      try {
          const feeds = await fetchExistingFeeds();
          const existingFeed = feeds.find(f => f.feed_url === feedUrl);
          if (existingFeed) {
            console.log(`   Found existing feed ID: ${existingFeed.id}`);
            return existingFeed; // Return the existing feed object
          }
      } catch (fetchError) {
          console.error(`  × Error fetching existing feeds after conflict: ${fetchError.message}`);
      }
      return null; // Couldn't determine existing ID
    }

    // Log other errors
    console.error(`× Failed to add feed "${title}" (${feedUrl}):`, error.message);
    if (error.response && error.response.data && error.response.data.error_message) {
      console.error(`  Miniflux Error: ${error.response.data.error_message}`);
    } else if (error.response) {
      console.error(`  Status: ${error.response.status}`);
    }
    return null; // Return null instead of throwing to continue with other feeds
  }
}

// Function to fetch all existing categories
async function fetchExistingCategories() {
    try {
        const response = await minifluxClient.get('/v1/categories');
        return response.data || [];
    } catch (error) {
        console.error('× Failed to fetch existing categories:', error.message);
        return []; // Return empty array on error
    }
}

// Function to fetch all existing feeds
async function fetchExistingFeeds() {
    try {
        const response = await minifluxClient.get('/v1/feeds');
        return response.data || [];
    } catch (error) {
        console.error('× Failed to fetch existing feeds:', error.message);
        return []; // Return empty array on error
    }
}

// Function to save bias mapping to JSON file
async function saveBiasMapping(biasMap) {
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(FEEDS_JSON_PATH), { recursive: true });
    await fs.writeFile(FEEDS_JSON_PATH, JSON.stringify(biasMap, null, 2));
    console.log(`Bias mapping saved to ${FEEDS_JSON_PATH}`);
  } catch (error) {
    console.error('× Failed to save bias mapping:', error.message);
    throw error; // Propagate error if saving fails
  }
}

// Main function to set up Miniflux with all feeds (non-destructive)
async function setupMiniflux() {
  try {
    // Set authentication header (Basic or API Key)
    await setAuthHeader();
    console.log('✓ Successfully authenticated with Miniflux');

    // Fetch existing state from Miniflux
    console.log('Fetching existing categories and feeds from Miniflux...');
    const existingCategories = await fetchExistingCategories();
    const existingFeeds = await fetchExistingFeeds();

    // Create maps for quick lookup
    const existingCategoriesMap = new Map(existingCategories.map(cat => [cat.title.toLowerCase(), cat]));
    const existingFeedsSet = new Set(existingFeeds.map(feed => feed.feed_url));
    const existingFeedUrlToIdMap = new Map(existingFeeds.map(feed => [feed.feed_url, feed.id]));

    console.log(`Found ${existingCategoriesMap.size} existing categories.`);
    console.log(`Found ${existingFeedsSet.size} existing feeds.`);

    // --- This step is removed/commented out to prevent deletion ---
    // console.log('Skipping clean step (non-destructive mode).');
    // await cleanMiniflux(); 

    const biasMap = {};
    const feedAddPromises = [];

    // Process categories first
    const uniqueCategoryTitles = [...new Set(rssSources.map(source => source.category))];
    const categoryTitleToIdMap = {};

    for (const categoryTitle of uniqueCategoryTitles) {
        const categoryId = await getOrCreateCategory(categoryTitle, existingCategoriesMap);
        if (categoryId) {
            categoryTitleToIdMap[categoryTitle] = categoryId;
        } else {
            console.error(`! Skipping feeds for category "${categoryTitle}" due to creation failure.`);
        }
    }

    // Iterate through sources defined in rssService.js
    for (const source of rssSources) {
      // Get category ID (check if creation succeeded)
      const categoryId = categoryTitleToIdMap[source.category];
      if (!categoryId) {
          console.warn(`! Skipping feed "${source.name}" because its category "${source.category}" could not be processed.`);
          continue; // Skip this feed if category failed
      }

      // Check if feed already exists by URL
      if (existingFeedsSet.has(source.url)) {
        console.log(`→ Feed "${source.name}" (${source.url}) already exists in Miniflux.`);
        // Get existing ID for bias map
        const existingFeedId = existingFeedUrlToIdMap.get(source.url);
        if (existingFeedId) {
             biasMap[source.url] = { 
                bias: source.bias,
                id: existingFeedId, // Use existing ID
                name: source.name,
                category: source.category // Store category for reference
             };
        } else {
             console.warn(`  ! Could not find existing ID for feed ${source.url}`);
        }
      } else {
        // Feed doesn't exist, attempt to add it
        console.log(`Adding feed: ${source.name} (${source.url}) to category ID ${categoryId}`);
        // Wrap addFeed in a function for Promise.allSettled
        feedAddPromises.push(async () => {
            const feed = await addFeed(source.url, categoryId, source.name);
            if (feed && feed.id) {
                // Store the feed ID and bias in the mapping
                biasMap[source.url] = { 
                    bias: source.bias,
                    id: feed.id, // Use newly added ID
                    name: source.name,
                    category: source.category // Store category for reference
                };
            } else {
                console.warn(`! Feed "${source.name}" added, but ID is missing or addition failed. Not adding to bias map.`);
            }
        });
      }
    }

    // Execute all pending feed additions concurrently (or sequentially if preferred)
    console.log(`Attempting to add ${feedAddPromises.length} new feeds...`);
    // Using Promise.allSettled to ensure all attempts complete, even if some fail
    const results = await Promise.allSettled(feedAddPromises.map(p => p()));
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            // Errors are already logged within addFeed, but we can log index if needed
            // console.error(`Error adding feed at index ${index}: ${result.reason}`);
        }
    });

    // Save the potentially updated bias mapping to JSON file
    // This map now includes both pre-existing feeds and newly added ones
    await saveBiasMapping(biasMap);

    console.log('✓ Miniflux setup/update process completed.');

  } catch (error) {
    console.error('× Miniflux setup failed:', error.message);
    if (error.stack) {
        console.error(error.stack);
    }
  }
}

// Export functions for use in other files
module.exports = {
  setupMiniflux,
  minifluxClient, // Export client if needed elsewhere
};

// Run the setup function if this file is executed directly
if (require.main === module) {
  setupMiniflux();
}
