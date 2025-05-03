const cron = require('node-cron');
const { fetchNews } = require('./miniflux/fetchEntries');
const { refreshAllFeeds } = require('./miniflux/refreshFeeds');
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
            bias: article.bias 
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

// Define the main fetching task
const fetchAllSources = async () => {
  console.log('\n--------------------\nCron Job: Starting Miniflux feed fetch task...');
  const startTime = Date.now();
  
  // REMOVED: Quick fetch logic - always refresh then fetch
  // let newsItems = [];
  // try {
  //   console.log('Quick fetch: Getting already cached entries from Miniflux...');
  //   newsItems = await fetchNews();
  //   console.log(`Found ${newsItems.length} cached news items in Miniflux`);
  // } catch (error) {
  //   console.error('Quick fetch failed:', error.message);
  // }

  try {
    // 1. Refresh feeds in Miniflux by calling the imported function
    console.log('Refreshing feeds in Miniflux via imported function...');
    try {
      await refreshAllFeeds();
      console.log('Feed refresh function completed.');
    } catch (refreshError) {
      console.error('Error caught during feed refresh function:', refreshError.message);
    }
    
    // 2. Wait a moment for Miniflux to potentially process (optional, might remove later)
    console.log('Waiting a moment after refresh...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Shortened wait
    
    // 3. Fetch news items from Miniflux AFTER refreshing
    console.log('Fetching entries from Miniflux after refresh...');
    const newsItems = await fetchNews(); // Fetch fresh items
    console.log(`Fetched ${newsItems.length} news items from Miniflux after refresh`);
        
    // --- ADD DEDUPLICATION STEP HERE ---
    const deduplicatedItems = deduplicateArticles(newsItems);
    
    // 4. Queue the *deduplicated* articles for LLM processing
    if (deduplicatedItems && deduplicatedItems.length > 0) {
      console.log(`Attempting to queue ${deduplicatedItems.length} deduplicated articles...`);
      deduplicatedItems.forEach(article => {
        // Add individual log if needed: console.log(`Pushing article miniflux-${article.id}`);
        processingQueue.push(article);
      });
      console.log(`Successfully finished queuing ${deduplicatedItems.length} articles.`);
    } else {
      console.log('No articles left after deduplication to process with LLM');
    }

    console.log('fetchAllSources function nearing completion.');
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nCron Job: Finished Miniflux feed fetch task in ${duration.toFixed(2)} seconds.`);

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`Cron Job: Error during Miniflux feed fetch task after ${duration.toFixed(2)} seconds:`, error);
  }
  console.log('--------------------\n');
};

/**
 * Deduplicates articles based on normalized title, keeping the one with the most specific category.
 * @param {Array<Object>} articles - Array of news item objects.
 * @returns {Array<Object>} - Deduplicated array of news item objects.
 */
const deduplicateArticles = (articles) => {
  if (!articles || articles.length === 0) {
    return [];
  }

  const articleMap = new Map();
  let duplicateCount = 0;
  let skippedCount = 0;

  articles.forEach(article => {
    // Normalize title: lowercase and trim whitespace
    const normalizedTitle = article.title?.toLowerCase().trim();

    // Skip articles without a valid title
    if (!normalizedTitle) {
      console.warn(`Skipping article ID ${article.id} due to missing or empty title.`);
      skippedCount++;
      return;
    }
    
    // Use normalized title as the primary identifier
    const key = normalizedTitle;

    if (articleMap.has(key)) {
      duplicateCount++;
      const existingArticle = articleMap.get(key);

      // Determine specificity by splitting category path (assuming 'feed.title' holds the path)
      // Example: "NYT > Arts > Music"
      const currentCategory = article.feed?.title || '';
      const existingCategory = existingArticle.feed?.title || '';
      
      const currentSpecificity = currentCategory.split(' > ').length;
      const existingSpecificity = existingCategory.split(' > ').length;

      // Keep the article with the more specific category path
      if (currentSpecificity > existingSpecificity) {
        articleMap.set(key, article);
      }
      // If specificities are equal, keep the one already in the map (first encountered)
    } else {
      articleMap.set(key, article);
    }
  });

  const deduplicatedList = Array.from(articleMap.values());
  console.log(`Deduplication complete: Input=${articles.length}, Output=${deduplicatedList.length}, Duplicates removed=${duplicateCount}, Skipped (no title)=${skippedCount}`);
  return deduplicatedList;
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

// Export immediately
module.exports = { scheduleFeedFetching };

// REMOVED old export line if it existed below