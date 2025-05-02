const cron = require('node-cron');
const { fetchNews } = require('./miniflux/fetchEntries');
const fs = require('fs');
const path = require('path');
const Queue = require('better-queue');
const { processNewsKeywords } = require('./services/wordProcessingService');

// Path to the refresh feeds script
const REFRESH_SCRIPT_PATH = path.join(__dirname, 'miniflux/refreshFeeds.js');

// Create a processing queue with concurrency control for LLM processing
const processingQueue = new Queue(async (batch, cb) => {
  try {
    console.log(`Processing batch of ${batch.length} articles with LLM...`);
    const batchStartTime = Date.now();
    
    // Process the batch with LLM integration
    const processed = await processNewsKeywords(batch);
    
    const batchDuration = (Date.now() - batchStartTime) / 1000;
    console.log(`Completed LLM processing for ${processed.length} articles in ${batchDuration.toFixed(2)} seconds`);
    
    // Return processed articles
    cb(null, processed);
  } catch (err) {
    console.error('Error in processing queue:', err);
    cb(err);
  }
}, { 
  concurrent: 5,     // Process 5 batches concurrently
  batchSize: 10,     // Process 10 articles per batch
  batchDelay: 100,   // Wait 100ms between batches
  maxRetries: 3,     // Retry failed batches up to 3 times
  retryDelay: 1000   // Wait 1s before retry
});

// Handle processed articles
processingQueue.on('task_finish', (taskId, result) => {
  // Store or handle the processed articles as needed
  console.log(`Finished processing batch ${taskId} with ${result.length} articles`);
});

// Define the main fetching task
const fetchAllSources = async () => {
  console.log('\n--------------------\nCron Job: Starting Miniflux feed fetch task...');
  const startTime = Date.now();

  try {
    // First refresh feeds in Miniflux to trigger fetching
    console.log('Refreshing feeds in Miniflux...');
    
    // Execute the refresh script using Node.js child_process with a timeout
    const { exec } = require('child_process');
    const refreshTimeout = 20000; // 20 seconds timeout
    
    try {
      await Promise.race([
        new Promise((resolve, reject) => {
          const refreshProcess = exec(`node ${REFRESH_SCRIPT_PATH}`, (error, stdout, stderr) => {
            if (error && !error.killed) {
              console.error(`Error refreshing feeds: ${error.message}`);
              return reject(error);
            }
            if (stderr) {
              console.error(`Refresh stderr: ${stderr}`);
            }
            console.log(stdout);
            resolve();
          });
        }),
        new Promise((resolve) => setTimeout(() => {
          console.log(`Refresh operation timed out after ${refreshTimeout/1000} seconds. Continuing...`);
          resolve();
        }, refreshTimeout))
      ]);
    } catch (error) {
      console.error('Refresh operation failed, but continuing with feed fetch:', error.message);
    }
    
    // Wait for Miniflux to process the feeds (10 seconds is sufficient)
    console.log('Waiting 10 seconds for Miniflux to process feeds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Fetch news items from Miniflux
    console.log('Fetching entries from Miniflux...');
    const newsItems = await fetchNews();
    console.log(`Fetched ${newsItems.length} news items from Miniflux`);
    
    // Queue all articles for LLM processing
    if (newsItems && newsItems.length > 0) {
      console.log('Queuing articles for LLM processing...');
      newsItems.forEach(article => {
        processingQueue.push(article);
      });
    } else {
      console.log('No articles to process with LLM');
    }

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
