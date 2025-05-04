const path = require('path');
// Ensure .env variables are loaded from the backend root
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); 

const { syncWithMinifluxFeeds } = require('../services/sourceManagementService');

/**
 * Runs the Miniflux feed synchronization process.
 */
async function runSync() {
  console.log('Starting Miniflux feed synchronization script...');
  try {
    await syncWithMinifluxFeeds();
    console.log('Synchronization script completed successfully.');
    process.exit(0); // Exit with success code
  } catch (error) {
    console.error('Error during Miniflux feed synchronization:', error);
    process.exit(1); // Exit with error code
  }
}

// Execute the sync function
runSync(); 