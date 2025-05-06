const cron = require('node-cron');
const { fetchAndProcessMinifluxEntries } = require('./services/rssService');
const fs = require('fs');
const path = require('path');
const Queue = require('better-queue');
const { processNewsKeywords, cacheAggregatedKeywords } = require('./services/wordProcessingService');
const NewsItem = require('./models/NewsItem');

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
  // --- Add detailed logging --- 
  console.log(`[task_finish ${taskId}] Received raw result type: ${typeof result}`);
  if (result) {
      console.log(`[task_finish ${taskId}] Raw result content (first element if array):`, JSON.stringify(Array.isArray(result) ? result[0] : result));
  }
  // --- End detailed logging --- 

  // Ensure result is an array, even if only one item was processed in the batch
  const processedArticles = Array.isArray(result) ? result : [result]; 
  console.log(`Finished processing batch ${taskId} with ${processedArticles.length} articles. Saving to DB...`);
  
  // --- Add logging after ensuring array --- 
  console.log(`[task_finish ${taskId}] processedArticles type: ${typeof processedArticles}, isArray: ${Array.isArray(processedArticles)}, length: ${processedArticles.length}`);
  if (processedArticles.length > 0) {
    console.log(`[task_finish ${taskId}] First element in processedArticles:`, JSON.stringify(processedArticles[0]));
  }
  // --- End logging --- 
  
  try {
    // Prepare bulk update operations
    // Filter for fulfilled promises and extract the actual result from the 'value' field
    const successfulResults = processedArticles
      .filter(result => result.status === 'fulfilled' && result.value && result.value.minifluxEntryId)
      .map(result => result.value); // Extract the 'value' which contains the LLM output

    // --- Add logging after filtering ---
    console.log(`[task_finish ${taskId}] successfulResults length (after filtering for fulfilled & minifluxEntryId): ${successfulResults.length}`);
    if (successfulResults.length !== processedArticles.length) {
        console.warn(`[task_finish ${taskId}] Some articles were filtered out or failed! Original count: ${processedArticles.length}, Successful count: ${successfulResults.length}`);
        // Log the first rejected/invalid item, if possible
        const rejectedItem = processedArticles.find(result => result.status !== 'fulfilled' || !result.value || !result.value.minifluxEntryId);
        console.log(`[task_finish ${taskId}] Example filtered/failed item:`, JSON.stringify(rejectedItem));
    }
    // --- End logging ---

    // Now map using the successfulResults array which contains the actual LLM data
    const operations = successfulResults.map(articleData => ({
      updateOne: {
        // Corrected Filter: Use minifluxEntryId from the extracted articleData
        filter: { minifluxEntryId: articleData.minifluxEntryId },
        update: {
          $set: {
            keywords: articleData.keywords,
            bias: articleData.bias, // Save LLM result to the main 'bias' field
            llmProcessed: true, // Mark as processed
            llmProcessingError: null, // Clear any previous error
            // Use attempts from the extracted data, incrementing it
            llmProcessingAttempts: (articleData.llmProcessingAttempts || 0) + 1
          },
          $unset: { contentSnippet: "" } // Optional: Remove snippet after processing
        },
        // upsert: false // Should not upsert here, only update existing
      }
    }));

    if (operations.length > 0) {
      const bulkResult = await NewsItem.bulkWrite(operations, { ordered: false }); // Add ordered: false
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
    // Find articles using Mongoose Model find()
    // Corrected Projection: Fetch fields needed for processing AND identification (minifluxEntryId)
    const articlesToProcess = await NewsItem.find(
      { llmProcessed: false }, 
      'title contentSnippet url minifluxEntryId llmProcessingAttempts' // Fetch snippet and miniflux ID
    )
    .limit(MAX_ARTICLES_TO_QUEUE)
    .lean() 
    .exec();

    if (articlesToProcess && articlesToProcess.length > 0) {
      console.log(`Found ${articlesToProcess.length} articles needing LLM processing. Queuing...`);
      articlesToProcess.forEach(article => {
        // Corrected Check: Ensure required fields fetched are present, be lenient on contentSnippet
        if (article.minifluxEntryId && article.title && typeof article.contentSnippet === 'string') {
           // Map to the structure expected by processNewsKeywords (assuming it needs 'content')
           // Also pass minifluxEntryId and attempts for the task_finish handler
           processingQueue.push({
               minifluxEntryId: article.minifluxEntryId, 
               title: article.title,
               content: article.contentSnippet, // Map snippet to content
               url: article.url,
               llmProcessingAttempts: article.llmProcessingAttempts || 0
           });
        } else {
          // Use `_id` if available for logging, otherwise try minifluxEntryId
          const logId = article._id || article.minifluxEntryId || 'Unknown ID'; 
          console.warn(`Skipping queuing article (ID: ${logId}) due to missing fields (minifluxEntryId, title, or contentSnippet).`);
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
  console.log('Scheduling cron jobs...');

  // 1. Fetch and Process Miniflux Entries (Every 5 minutes)
  cron.schedule('*/5 * * * *', fetchAllSources);
  console.log('Scheduled: Fetch Miniflux entries every 5 minutes.');

  // 2. Queue articles for LLM processing (Every 1 minute, offset)
  // Runs more frequently to keep the LLM queue fed
  setTimeout(() => {
    cron.schedule('*/1 * * * *', processQueuedArticles);
    console.log('Scheduled: Queue articles for LLM processing every 1 minute (with initial delay).');
    // Run immediately on startup after initial delay
    processQueuedArticles();
  }, 15000); // Start 15 seconds after main fetch schedule

  // 3. Update Aggregated Keyword Cache (Every 2 minutes, offset)
  setTimeout(() => {
    cron.schedule('*/2 * * * *', async () => {
      console.log('\n+++++++++++++++\nCron Job: Starting keyword cache update task...');
      const startTime = Date.now();
      try {
        await cacheAggregatedKeywords();
        const duration = (Date.now() - startTime) / 1000;
        console.log(`Cron Job: Finished keyword cache update task in ${duration.toFixed(2)} seconds.`);
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        console.error(`Cron Job: Error during keyword cache update task after ${duration.toFixed(2)} seconds:`, error);
      }
       console.log('+++++++++++++++\n');
    });
    console.log('Scheduled: Update aggregated keyword cache every 2 minutes (with initial delay).');
    // Run immediately on startup after initial delay
    cacheAggregatedKeywords();
  }, 30000); // Start 30 seconds after main fetch schedule (15s after LLM queue)

  // Initial run for main fetch on startup
  console.log('Running initial Miniflux fetch on startup...');
  fetchAllSources(); 
};

// --- UPDATED Export ---
module.exports = { scheduleCronJobs };

// REMOVED old export line if it existed below