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
    // Format error message to avoid excessive logging
    let errorMessage = 'Error in processing queue';
    
    if (err.code) {
      errorMessage += `: ${err.code}`;
    } else if (err.message) {
      errorMessage += `: ${err.message}`;
    }
    
    console.error(errorMessage);
    cb(err);
  }
}, { 
  concurrent: 8,     // Increased from 5 to 8 for better throughput
  batchSize: 15,     // Increased from 10 to 15 for better efficiency
  batchDelay: 50,    // Reduced from 100ms to 50ms
  maxRetries: 2,     // Reduced from 3 to 2 to fail faster on persistent errors
  retryDelay: 500    // Reduced from 1000ms to 500ms for faster retries
});

// Handle queue events with clean logging
processingQueue.on('task_finish', (taskId, result) => {
  // Store or handle the processed articles as needed
  console.log(`Finished processing batch ${taskId} with ${result.length} articles`);
});

// Add error handling for queue errors
processingQueue.on('task_failed', (taskId, err) => {
  // Clean error message without full error dump
  let errorMessage = `Batch ${taskId} processing failed`;
  if (err.code) {
    errorMessage += `: ${err.code}`;
  } else if (err.message) {
    errorMessage += `: ${err.message}`;
  }
  console.error(errorMessage);
});

// Add queue error handling
processingQueue.on('error', (err) => {
  console.error('Queue system error:', err.message || 'Unknown error');
});

// Define the main fetching task
const fetchAllSources = async () => {
  console.log('\n--------------------\nCron Job: Starting Miniflux feed fetch task...');
  const startTime = Date.now();
  let newsItems = [];
  
  // Check if there are any cached news items already
  try {
    // First try to fetch entries without refreshing to speed up startup
    console.log('Quick fetch: Getting already cached entries from Miniflux...');
    newsItems = await fetchNews();
    console.log(`Found ${newsItems.length} cached news items in Miniflux`);
  } catch (error) {
    console.error('Quick fetch failed:', error.message);
  }

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
    
    // Reduced waiting time for Miniflux to process feeds
    console.log('Waiting for Miniflux to process feeds...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Reduced from 10s to 3s
    
    // Fetch news items from Miniflux if we don't already have cached ones
    if (!newsItems.length) {
      console.log('Fetching entries from Miniflux...');
      newsItems = await fetchNews();
      console.log(`Fetched ${newsItems.length} news items from Miniflux`);
    } else {
      console.log('Using cached news items to speed up startup');
    }
    
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
