const cron = require('node-cron');
const { fetchNews } = require('./miniflux/fetchEntries');
const fs = require('fs');
const path = require('path');

// Path to the refresh feeds script
const REFRESH_SCRIPT_PATH = path.join(__dirname, 'miniflux/refreshFeeds.js');

// Define the main fetching task
const fetchAllSources = async () => {
  console.log('\n--------------------\nCron Job: Starting Miniflux feed fetch task...');
  const startTime = Date.now();

  try {
    // First refresh feeds in Miniflux to trigger fetching
    console.log('Refreshing feeds in Miniflux...');
    
    // Execute the refresh script using Node.js child_process
    const { exec } = require('child_process');
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
    
    // Wait for Miniflux to process the feeds (30 seconds)
    console.log('Waiting 30 seconds for Miniflux to process feeds...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Fetch news items from Miniflux
    console.log('Fetching entries from Miniflux...');
    const newsItems = await fetchNews();
    console.log(`Fetched ${newsItems.length} news items from Miniflux`);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nCron Job: Finished Miniflux feed fetch task in ${duration.toFixed(2)} seconds.`);

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`Cron Job: Error during Miniflux feed fetch task after ${duration.toFixed(2)} seconds:`, error);
  }
  console.log('--------------------\n');
};

// Schedule the task to run every 30 minutes
// Syntax: second minute hour day-of-month month day-of-week
// '*/30 * * * *' means "at every 30th minute"
const scheduleFeedFetching = () => {
  console.log('Scheduling feed fetching cron job (every 30 minutes).');
  cron.schedule('*/30 * * * *', () => {
    fetchAllSources();
  }, {
    scheduled: true,
    timezone: "America/New_York" // Optional: Set timezone
  });

  // Optional: Run once immediately on startup
  console.log('Running initial feed fetch on startup...');
  fetchAllSources();
};

module.exports = { scheduleFeedFetching };
