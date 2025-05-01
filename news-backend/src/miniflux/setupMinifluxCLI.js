#!/usr/bin/env node

// This script provides a CLI interface for setting up and managing Miniflux feeds

const { setupMiniflux, getAuthToken, minifluxClient } = require('./setupMiniflux');
const fs = require('fs/promises');
const path = require('path');
const readline = require('readline');

// Path to feeds.json containing the bias mapping
const FEEDS_JSON_PATH = path.join(__dirname, '../../data/feeds.json');

// Create readline interface for CLI interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to display the main menu
function displayMainMenu() {
  console.log('\n===== INFOCLOUD Miniflux Management =====');
  console.log('1. Set up Miniflux with all feeds from rssService');
  console.log('2. Add a single feed to Miniflux');
  console.log('3. List all feeds in Miniflux');
  console.log('4. Refresh all feeds in Miniflux');
  console.log('5. Get Miniflux API key');
  console.log('6. Exit');
  console.log('=========================================');
  
  rl.question('Choose an option: ', handleMenuChoice);
}

// Function to handle menu choices
function handleMenuChoice(choice) {
  switch (choice) {
    case '1':
      setupMiniflux()
        .then(() => {
          console.log('\nMiniflux setup completed!');
          setTimeout(displayMainMenu, 1000);
        })
        .catch(err => {
          console.error('Error setting up Miniflux:', err.message);
          setTimeout(displayMainMenu, 1000);
        });
      break;
      
    case '2':
      addSingleFeed();
      break;
      
    case '3':
      listAllFeeds()
        .then(() => setTimeout(displayMainMenu, 1000))
        .catch(err => {
          console.error('Error listing feeds:', err.message);
          setTimeout(displayMainMenu, 1000);
        });
      break;
      
    case '4':
      refreshAllFeeds()
        .then(() => setTimeout(displayMainMenu, 1000))
        .catch(err => {
          console.error('Error refreshing feeds:', err.message);
          setTimeout(displayMainMenu, 1000);
        });
      break;
      
    case '5':
      getMinifluxApiKey()
        .then(() => setTimeout(displayMainMenu, 1000))
        .catch(err => {
          console.error('Error getting API key:', err.message);
          setTimeout(displayMainMenu, 1000);
        });
      break;
      
    case '6':
      console.log('Goodbye!');
      rl.close();
      break;
      
    default:
      console.log('Invalid option. Please try again.');
      displayMainMenu();
      break;
  }
}

// Function to add a single feed
function addSingleFeed() {
  rl.question('\nEnter feed URL: ', (url) => {
    rl.question('Enter feed title: ', (title) => {
      rl.question('Enter category (e.g., News, Politics, Tech): ', (category) => {
        rl.question('Enter bias (Left, Liberal, Centrist, Conservative, Right, Unknown): ', async (bias) => {
          try {
            // Authenticate with Miniflux
            await getAuthToken();
            
            // Check if category exists, create if not
            let categoryId;
            try {
              const categoriesResponse = await minifluxClient.get('/v1/categories');
              const categories = categoriesResponse.data;
              const existingCategory = categories.find(c => c.title.toLowerCase() === category.toLowerCase());
              
              if (existingCategory) {
                categoryId = existingCategory.id;
              } else {
                const newCategory = await minifluxClient.post('/v1/categories', { title: category });
                categoryId = newCategory.data.id;
              }
            } catch (error) {
              console.error('Error getting/creating category:', error.message);
              setTimeout(displayMainMenu, 1000);
              return;
            }
            
            // Add feed to Miniflux
            const response = await minifluxClient.post('/v1/feeds', {
              feed_url: url,
              category_id: categoryId,
              title: title,
              crawler: true
            });
            
            console.log(`\nFeed added successfully! Feed ID: ${response.data.id}`);
            
            // Update bias mapping
            const biasMap = JSON.parse(await fs.readFile(FEEDS_JSON_PATH, 'utf8'));
            biasMap[response.data.feed_url] = { 
              bias: bias,
              id: response.data.id,
              name: title
            };
            
            await fs.writeFile(FEEDS_JSON_PATH, JSON.stringify(biasMap, null, 2));
            console.log('Bias mapping updated in feeds.json');
            
            setTimeout(displayMainMenu, 1000);
          } catch (error) {
            console.error('Error adding feed:', error.message);
            setTimeout(displayMainMenu, 1000);
          }
        });
      });
    });
  });
}

// Function to list all feeds
async function listAllFeeds() {
  try {
    // Authenticate with Miniflux
    await getAuthToken();
    
    // Get all feeds
    const response = await minifluxClient.get('/v1/feeds');
    const feeds = response.data;
    
    // Load bias mapping
    const biasMap = JSON.parse(await fs.readFile(FEEDS_JSON_PATH, 'utf8'));
    
    console.log('\n===== Miniflux Feeds =====');
    console.log('Total feeds:', feeds.length);
    
    feeds.forEach(feed => {
      const bias = biasMap[feed.feed_url] ? biasMap[feed.feed_url].bias : 'Unknown';
      console.log(`\nID: ${feed.id}`);
      console.log(`Title: ${feed.title}`);
      console.log(`URL: ${feed.feed_url}`);
      console.log(`Category: ${feed.category.title}`);
      console.log(`Bias: ${bias}`);
    });
    
    console.log('\n=========================');
  } catch (error) {
    console.error('Error listing feeds:', error.message);
  }
}

// Function to refresh all feeds
async function refreshAllFeeds() {
  try {
    // Authenticate with Miniflux
    await getAuthToken();
    
    // Get all feeds
    const response = await minifluxClient.get('/v1/feeds');
    const feeds = response.data;
    
    console.log(`\nRefreshing ${feeds.length} feeds...`);
    
    // Refresh each feed
    for (const feed of feeds) {
      try {
        await minifluxClient.put(`/v1/feeds/${feed.id}/refresh`);
        console.log(`Refreshed: ${feed.title}`);
      } catch (error) {
        console.error(`Error refreshing feed ${feed.title}:`, error.message);
      }
    }
    
    console.log('\nAll feeds refresh triggered');
  } catch (error) {
    console.error('Error refreshing feeds:', error.message);
  }
}

// Function to get Miniflux API key
async function getMinifluxApiKey() {
  try {
    // Authenticate with Miniflux
    await getAuthToken();
    
    // Create API key
    const response = await minifluxClient.post('/v1/users/1/api_keys', {
      description: 'INFOCLOUD Integration'
    });
    
    console.log('\n===== Miniflux API Key =====');
    console.log('API Key:', response.data.api_key);
    console.log('\nAdd this to your .env file as MINIFLUX_API_KEY=your_key_here');
    console.log('=============================');
  } catch (error) {
    console.error('Error getting API key:', error.message);
    console.log('Try checking Miniflux web interface → Settings → API Keys');
  }
}

// Start the CLI
console.log('Welcome to the INFOCLOUD Miniflux Management CLI');
displayMainMenu();

// Handle Ctrl+C and proper exit
process.on('SIGINT', () => {
  console.log('\nExiting...');
  rl.close();
  process.exit(0);
});
