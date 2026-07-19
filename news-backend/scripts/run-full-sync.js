const fs = require('fs').promises;
const path = require('path');
// Adjust dotenv path to load from the backend root
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { syncWithMinifluxFeeds } = require('../src/services/sourceManagementService');

// Define the path to the sources file consistently
const SOURCES_FILE_PATH_SCRIPT = path.join(__dirname, '..', 'data', 'master_sources.json');

async function checkFileContent() {
  console.log(`[Debug] Attempting to read file directly: ${SOURCES_FILE_PATH_SCRIPT}`);
  try {
    const rawData = await fs.readFile(SOURCES_FILE_PATH_SCRIPT, 'utf-8');
    const jsonData = JSON.parse(rawData);
    console.log('[Debug] Successfully read and parsed file. First 3 entries:');
    console.log(JSON.stringify(jsonData.slice(0, 3), null, 2)); // Log first 3 entries
    // Check specifically for minifluxFeedId in the first entry
    if (jsonData.length > 0) {
      console.log(`[Debug] First entry has minifluxFeedId field: ${jsonData[0].hasOwnProperty('minifluxFeedId')}`);
      console.log(`[Debug] Value of minifluxFeedId in first entry: ${jsonData[0].minifluxFeedId}`);
    } else {
      console.log('[Debug] File is empty or not an array.');
    }
  } catch (error) {
    console.error('[Debug] Error reading or parsing file directly:', error);
  }
}

async function runSync() {
  // await checkFileContent(); // REMOVE Call
  console.log('Starting full source synchronization...');
  try {
    await syncWithMinifluxFeeds();
    console.log('Full source synchronization completed successfully.');
  } catch (error) {
    console.error('Full source synchronization failed:', error);
  }
}

runSync(); 