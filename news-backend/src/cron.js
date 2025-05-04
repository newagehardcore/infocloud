const cron = require('node-cron');
const { fetchAndProcessMinifluxEntries } = require('./services/rssService');
const fs = require('fs');
const path = require('path');
const Queue = require('better-queue');
const { processNewsKeywords } = require('./services/wordProcessingService');
const { getDB } = require('./config/db');

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
processingQueue.on('task_finish', async (taskId, result) => {
  console.log(`Finished processing batch ${taskId} with ${result.length} articles. Saving to DB...`);
  try {
    const db = getDB();
    const newsCollection = db.collection('newsitems');

    // Prepare bulk update operations
    const operations = result.map(article => ({
      updateOne: {
        filter: { id: article.id }, // Assuming miniflux 'id' is unique and present
        update: { 
          $set: { 
            keywords: article.keywords, 
            llmBias: article.bias // Save LLM result to llmBias field
          }
        },
        // upsert: true // Optional: If you want to insert if somehow missing (use with caution)
      }
    }));

    if (operations.length > 0) {
      const bulkResult = await newsCollection.bulkWrite(operations);
      console.log(`DB Save Complete for batch ${taskId}: Matched ${bulkResult.matchedCount}, Modified ${bulkResult.modifiedCount}`);
    } else {
      console.log(`No operations to save for batch ${taskId}.`);
    }

  } catch (error) {
    console.error(`Error saving processed batch ${taskId} to DB:`, error);
  }
});

// Add error handling for queue errors
processingQueue.on('task_failed', (taskId, err) => {
  // Log the full error object for better debugging
  console.error(`Batch ${taskId} processing failed. Full Error:`, err);
});

// Add queue error handling
processingQueue.on('error', (err) => {
  console.error('Queue system error:', err.message || 'Unknown error');
});

// Define the main fetching task (now simplified)
const fetchAllSources = async () => {
  console.log('\n--------------------\nCron Job: Starting Miniflux entry processing task...');
  const startTime = Date.now();
  
  try {
    // Call the consolidated service function
    await fetchAndProcessMinifluxEntries();

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nCron Job: Finished Miniflux entry processing task in ${duration.toFixed(2)} seconds.`);

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`Cron Job: Error during Miniflux entry processing task after ${duration.toFixed(2)} seconds:`, error);
  }
  console.log('--------------------\n');
};

// --- NEW: Function to find and queue articles for LLM processing --- 
const processQueuedArticles = async () => {
  console.log('\n~~~~~~~~~~~~~~~~~~~~\nCron Job: Starting LLM processing queue task...');
  const queueStartTime = Date.now();
  const MAX_ARTICLES_TO_QUEUE = 200; // Limit articles queued per run

  try {
    const db = getDB();
    const newsCollection = db.collection('newsitems');

    // Find articles that haven't been processed by the LLM yet
    // Using existence of 'keywords' field as the indicator
    const articlesToProcess = await newsCollection.find(
      { keywords: { $exists: false } }, 
      {
        limit: MAX_ARTICLES_TO_QUEUE, 
        projection: { id: 1, title: 1, content: 1, url: 1 } // Only fetch necessary fields
      }
    ).toArray();

    if (articlesToProcess && articlesToProcess.length > 0) {
      console.log(`Found ${articlesToProcess.length} articles needing LLM processing. Queuing...`);
      articlesToProcess.forEach(article => {
        // Ensure article has an id, title, and content for processing
        if (article.id && article.title && article.content) {
           processingQueue.push(article);
        } else {
          console.warn(`Skipping queuing article (ID: ${article._id}) due to missing fields (id, title, or content).`);
        }
      });
      console.log(`Finished queuing ${articlesToProcess.length} articles.`);
    } else {
      console.log('No articles found needing LLM processing in this cycle.');
    }

    const queueDuration = (Date.now() - queueStartTime) / 1000;
    console.log(`\nCron Job: Finished LLM processing queue task in ${queueDuration.toFixed(2)} seconds.`);

  } catch (error) {
    const queueDuration = (Date.now() - queueStartTime) / 1000;
    console.error(`Cron Job: Error during LLM processing queue task after ${queueDuration.toFixed(2)} seconds:`, error);
  }
  console.log('~~~~~~~~~~~~~~~~~~~~\n');
};

// --- RENAMED and UPDATED Scheduling function ---
// Schedule the tasks
const scheduleCronJobs = () => {
  // Schedule feed fetching (every 15 minutes)
  console.log('Scheduling feed fetching cron job (every 15 minutes: */15 * * * *).');
  cron.schedule('*/15 * * * *', () => {
    fetchAllSources();
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  // Schedule LLM processing queue job (every 5 minutes)
  console.log('Scheduling LLM processing queue job (every 5 minutes: */5 * * * *).');
  cron.schedule('*/5 * * * *', () => {
    processQueuedArticles();
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  // Optional: Run initial tasks on startup
  console.log('Running initial feed fetch on startup...');
  fetchAllSources(); 
  // Add a small delay before the first LLM queue run to allow feeds to fetch
  setTimeout(() => {
      console.log('Running initial LLM processing queue check on startup...');
      processQueuedArticles();
  }, 15000); // Wait 15 seconds after startup
};

// --- UPDATED Export ---
module.exports = { scheduleCronJobs };

// REMOVED old export line if it existed below