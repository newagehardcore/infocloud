const { connectDB, getDB, closeDB } = require('../config/db');
require('dotenv').config(); // Load environment variables
const { exec } = require('child_process');
const path = require('path');
const { PoliticalBias, NewsCategory } = require('../types');

// Script to reset the database and fetch fresh content from Miniflux
async function resetAndFetch() {
  let db;
  try {
    console.log('========== RESET AND FETCH NEW CONTENT ==========');
    
    // 1. Connect to the database
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected');
    
    db = getDB();
    const newsCollection = db.collection('newsitems');
    
    // 2. Clear out existing news items
    console.log('Clearing existing news items from database...');
    const deleteResult = await newsCollection.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} news items from database`);
    
    // 3. Refresh feeds in Miniflux
    console.log('\nRefreshing feeds in Miniflux...');
    const REFRESH_SCRIPT_PATH = path.join(__dirname, 'refreshFeeds.js');
    
    await new Promise((resolve, reject) => {
      exec(`node ${REFRESH_SCRIPT_PATH}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error refreshing feeds: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.error(`Refresh stderr: ${stderr}`);
        }
        console.log(stdout);
        resolve();
      });
    });
    
    // 4. Wait for Miniflux to process the feeds
    console.log('\nWaiting 30 seconds for Miniflux to process feeds...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // 5. Fetch news items from Miniflux
    console.log('\nFetching news items from Miniflux...');
    // const newsItems = await fetchNews();
    console.log('fetchNews call has been removed. The script now only clears the database.');
    console.log('If fetching is still required, this script needs to be updated to use the new data pipeline (e.g., trigger rssService.forceRefreshAllFeeds or similar).');
    
    console.log('\n========== COMPLETED ==========');
    console.log('Your INFOCLOUD should now display fresh content from Miniflux!');
    console.log('If you still see old content, try refreshing your frontend application.');
    
  } catch (error) {
    console.error('Error during reset and fetch process:', error);
  } finally {
    if (db) {
      await closeDB();
      console.log('Database connection closed.');
    }
    // Ensure process exits even if there's an error in async code
    process.exit(0);
  }
}

if (require.main === module) {
  resetAndFetch();
}
