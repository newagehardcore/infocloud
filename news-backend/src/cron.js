const cron = require('node-cron');
const { fetchAndProcessMinifluxEntries, markEntriesAsRead } = require('./services/rssService');
const fs = require('fs');
const path = require('path');
const Queue = require('better-queue');
const { processNewsKeywords, aggregateKeywordsForCloud } = require('./services/wordProcessingService');
const NewsItem = require('./models/NewsItem');

// Path to the refresh feeds script
const REFRESH_SCRIPT_PATH = path.join(__dirname, 'miniflux/refreshFeeds.js');

// Create a processing queue with concurrency control for LLM processing
const processingQueue = new Queue(async (batch, cb) => {
  try {
    // >>> MODIFIED WORKER LOGIC <<<
    console.log(`[Cron Queue Worker DEBUG] STARTING processing for batch. Batch length: ${batch.length}.`);
    console.log(`[Cron Queue Worker] Received batch of ${batch.length} job(s).`);
    if (batch.length > 0) {
      console.log(`[Cron Queue Worker] Sample job object from batch[0]: ${JSON.stringify(batch[0])}`);
    }

    const articlesToProcessFull = [];
    for (const job of batch) {
      if (job && job.minifluxEntryId) {
        const article = await NewsItem.findOne({ minifluxEntryId: job.minifluxEntryId })
                                      .select('title contentSnippet url minifluxEntryId llmProcessingAttempts _id source bias') // Select necessary fields
                                      .lean();
        if (article) {
          articlesToProcessFull.push(article);
        } else {
          console.warn(`[Cron Queue Worker] Article not found for minifluxEntryId: ${job.minifluxEntryId}`);
        }
      } else {
        console.warn('[Cron Queue Worker] Received invalid job in batch:', job);
      }
    }

    if (articlesToProcessFull.length === 0) {
      console.log('[Cron Queue Worker] No valid articles to process after fetching from DB.');
      return cb(null, []); // Return empty array if no articles found
    }
    // >>> END MODIFIED WORKER LOGIC <<<

    console.log(`Processing ${articlesToProcessFull.length} full articles with LLM...`);
    const batchStartTime = Date.now();
    
    const results = await processNewsKeywords(articlesToProcessFull); // Pass the full article objects
    const batchEndTime = Date.now();
    console.log(`Batch LLM processing took ${(batchEndTime - batchStartTime) / 1000} seconds for ${results.length} results.`);

    console.log(`[Cron Queue Worker DEBUG] COMPLETED LLM processing for batch. Calling success callback cb(null, results) now. Results length: ${results.length}`);
    cb(null, results);
  } catch (err) {
    let errorMessage = 'Error in processing queue';
    if (err.code) errorMessage += `: ${err.code}`;
    else if (err.message) errorMessage += `: ${err.message}`;
    console.error(errorMessage);
    console.error('[Cron Queue Worker DEBUG] ERROR in batch processing. Calling error callback cb(err) now.', err);
    cb(err);
  }
}, { 
  concurrent: 1,     // <<<< REDUCED FROM 8 to 1
  batchSize: 15,     
  batchDelay: 50,    
  maxRetries: 2,     
  retryDelay: 500    
});

processingQueue.on('task_finish', async (taskId, result) => {
  console.log(`[Cron task_finish DEBUG] STARTING for taskId: ${taskId}. Result items (approx): ${Array.isArray(result) ? result.length : (result ? 1 : 0)}`);
  const processedArticles = Array.isArray(result) ? result : (result ? [result] : []);
  console.log(`Finished processing batch ${taskId} with ${processedArticles.length} articles. Saving to DB...`);

  const successfulResults = processedArticles.filter(item => item && item.minifluxEntryId && item.llmProcessed);
  console.log(`[task_finish ${taskId}] successfulResults length (after filtering for minifluxEntryId AND llmProcessed): ${successfulResults.length}`);

  if (successfulResults.length > 0) {
    const bulkOps = NewsItem.collection.initializeUnorderedBulkOp();
    successfulResults.forEach(sResult => {
      // Separate $set and $inc operations for the update
      const fieldsToSet = {
        keywords: sResult.keywords,
        bias: sResult.bias,
        llmProcessed: true,
        processedAt: sResult.processedAt || new Date(),
      };
      const fieldsToIncrement = {
        llmProcessingAttempts: 1
      };
      
      bulkOps.find({ minifluxEntryId: sResult.minifluxEntryId }).updateOne({
        $set: fieldsToSet,
        $inc: fieldsToIncrement
      });
    });

    if (bulkOps.length > 0) {
      const firstSR = successfulResults[0];
      // Reconstruct sample update log to reflect the new structure
      const sampleUpdateLog = {
        $set: {
        keywords: firstSR.keywords,
        bias: firstSR.bias,
        llmProcessed: true,
        processedAt: firstSR.processedAt || new Date(),
        },
        $inc: { llmProcessingAttempts: 1 }
      };
      console.log(`[task_finish ${taskId}] Sample update for DB:`, JSON.stringify(sampleUpdateLog));
    }

    try {
      const bulkResult = await bulkOps.execute();
      console.log(`DB Save Complete for batch ${taskId}: Matched ${bulkResult.matchedCount}, Modified ${bulkResult.modifiedCount}`);
      const entryIdsToMarkAsRead = successfulResults.map(sResult => Number(sResult.minifluxEntryId)).filter(id => !isNaN(id));
      if (entryIdsToMarkAsRead.length > 0) {
        await markEntriesAsRead(entryIdsToMarkAsRead);
        console.log(`[task_finish ${taskId}] Marked ${entryIdsToMarkAsRead.length} entries as read in Miniflux.`);
      }
    } catch (error) {
      console.error(`Error executing bulk update for batch ${taskId}:`, error);
    }
  } else {
    console.log(`No successful results to save for batch ${taskId}.`);
  }
});

processingQueue.on('task_failed', (taskId, err) => {
  console.error(`[Cron task_failed DEBUG] STARTING for taskId: ${taskId}. Error:`, err?.message || 'Unknown error');
  console.error(`Batch ${taskId} processing failed. Full Error:`, err);
});

processingQueue.on('error', (err) => {
  console.error('Queue system error:', err.message || 'Unknown error');
});

const fetchAllSources = async () => {
  console.log('\n--------------------\nCron Job: Starting Miniflux entry processing task...');
  const startTime = Date.now();
  try {
    await fetchAndProcessMinifluxEntries();
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nCron Job: Finished Miniflux entry processing task in ${duration.toFixed(2)} seconds.`);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`Cron Job: Error during Miniflux entry processing task after ${duration.toFixed(2)} seconds:`, error);
  }
  console.log(`--------------------\n`);
};

const processQueuedArticles = async () => {
  console.log(`\n~~~~~~~~~~~~~~~~~~~~
Cron Job: Starting LLM processing queue task...`);
  const queueStartTime = Date.now();
  const MAX_ARTICLES_TO_QUEUE = 200;

  try {
    const articlesToProcess = await NewsItem.find(
      { llmProcessed: false },
      'minifluxEntryId' // <<< ONLY FETCH minifluxEntryId HERE
    )
    .limit(MAX_ARTICLES_TO_QUEUE)
    .lean()
    .exec();

    if (articlesToProcess && articlesToProcess.length > 0) {
      const articlesForQueue = articlesToProcess.map(article => {
        if (!article.minifluxEntryId) { // Simpler check now
          console.warn(`[Cron processQueuedArticles] Skipping article with missing minifluxEntryId. Original DB _id (if fetched): ${article._id ? article._id.toString() : 'N/A'}`);
          return null;
        }
        return { minifluxEntryId: article.minifluxEntryId.toString() }; 
      }).filter(job => job !== null);

      if (articlesForQueue.length > 0) {
        console.log(`[Cron processQueuedArticles DEBUG] PRE-PUSH CHECK: First job in articlesForQueue: ${JSON.stringify(articlesForQueue[0])}`);
      }

      if (articlesForQueue.length > 0) {
        articlesForQueue.forEach(job => processingQueue.push(job));
        console.log(`Finished queuing ${articlesForQueue.length} articles individually.`);
      } else {
        console.log('[Cron processQueuedArticles] No valid articles to queue after filtering.');
      }
    } else {
      console.log('No articles found needing LLM processing.');
    }

    const queueDuration = (Date.now() - queueStartTime) / 1000;
    console.log(`\nCron Job: Finished LLM processing queue task in ${queueDuration.toFixed(2)} seconds.`);

  } catch (error) {
    const queueDuration = (Date.now() - queueStartTime) / 1000;
    console.error(`Cron Job: Error during LLM processing queue task after ${queueDuration.toFixed(2)} seconds:`, error);
  }
  console.log(`~~~~~~~~~~~~~~~~~~~~\n`);
};

const scheduleCronJobs = () => {
  console.log('Scheduling cron jobs...');
  cron.schedule('*/5 * * * *', fetchAllSources);
  console.log('Scheduled: Fetch Miniflux entries every 5 minutes.');
  setTimeout(() => {
    cron.schedule('*/1 * * * *', processQueuedArticles);
    console.log('Scheduled: Queue articles for LLM processing every 1 minute (with initial delay).');
    processQueuedArticles();
  }, 15000);

  // Schedule Update aggregated keyword cache (removed setTimeout wrapper)
  cron.schedule('*/2 * * * *', async () => {
    console.log(`\n+++++++++++++++\nCron Job: Starting keyword cache update task (using aggregateKeywordsForCloud)...`);
    const startTime = Date.now();
    try {
      await aggregateKeywordsForCloud();
      const duration = (Date.now() - startTime) / 1000;
      console.log(`Cron Job: Finished keyword cache update task in ${duration.toFixed(2)} seconds.`);
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      console.error(`Cron Job: Error during keyword cache update task after ${duration.toFixed(2)} seconds:`, error);
    }
     console.log(`+++++++++++++++                 \n`);
  });
  console.log('Scheduled: Update aggregated keyword cache every 2 minutes.'); // Updated log message

  console.log('Running initial Miniflux fetch on startup...');
  fetchAllSources(); 

  console.log('Running initial keyword aggregation on startup...');
  aggregateKeywordsForCloud(); // Explicit initial call for cache population
};

module.exports = { scheduleCronJobs };