import NewsItem from '../models/NewsItem'; // Ensure NewsItem model is imported

// Define the task completion handler (task_finish)
const task_finish = async (job, result) => {
    const batchId = job.data.batchId;
    // 'result' is the array returned by the processor (processNewsKeywords)
    const processedArticles = result; 
    const totalProcessed = Array.isArray(processedArticles) ? processedArticles.length : 0;

    console.log(`Finished processing batch ${batchId} with ${totalProcessed} articles. Saving to DB...`);

    // --- START DEBUG LOGGING ---
    console.log(`[task_finish ${batchId}] Raw results received (type: ${typeof processedArticles}, isArray: ${Array.isArray(processedArticles)}, length: ${totalProcessed}):`);
    // Log first few items without stringify to see raw types
    if (Array.isArray(processedArticles)) {
        processedArticles.slice(0, 3).forEach((item, index) => {
            console.log(`[task_finish ${batchId}] Raw Item ${index}:`, item);
        });
        if (totalProcessed > 3) {
            console.log(`[task_finish ${batchId}] (... more items)`);
        }
    } else {
         console.log(`[task_finish ${batchId}] Raw result non-array:`, processedArticles);
    }
     // --- END DEBUG LOGGING ---


    if (!Array.isArray(processedArticles) || processedArticles.length === 0) {
        console.warn(`[task_finish ${batchId}] No processed articles array found in result.`);
        return;
    }

    const operations = processedArticles
        .filter(res => {
            // --- START DEBUG LOGGING INSIDE FILTER ---
            let passes = false;
            let reason = 'Unknown';
            if (!res) {
                reason = 'Result is null/undefined';
            } else if (res.status !== 'fulfilled') {
                reason = `Status is not 'fulfilled' (${res.status})`;
                if (res.reason) console.warn(`[task_finish ${batchId}] Rejected promise reason:`, res.reason);
            } else if (!res.value) {
                 reason = 'Fulfilled promise has no value';
            } else if (typeof res.value.minifluxEntryId === 'undefined' || res.value.minifluxEntryId === null) {
                 reason = `Fulfilled promise value missing minifluxEntryId (type: ${typeof res.value.minifluxEntryId})`;
                 console.warn(`[task_finish ${batchId}] Value missing ID:`, JSON.stringify(res.value));
            } else {
                passes = true;
                reason = 'Passes filter';
            }
            // console.log(`[task_finish ${batchId}] Filtering item: ID=${res?.value?.minifluxEntryId}, Status=${res?.status}, Passes=${passes}, Reason=${reason}`);
             // --- END DEBUG LOGGING INSIDE FILTER ---
            return passes;
        })
        .map(result => {
            const { bias, keywords, minifluxEntryId, llmProcessingAttempts } = result.value;
             // Ensure values are reasonable, provide defaults if necessary
             const safeBias = Object.values(PoliticalBias).includes(bias) ? bias : PoliticalBias.Unknown;
             const safeKeywords = Array.isArray(keywords) ? keywords.map(k => String(k)) : []; // Ensure keywords are strings

            return {
                updateOne: {
                    filter: { minifluxEntryId: String(minifluxEntryId) }, // Ensure ID is string for query
                    update: {
                        $set: {
                            llmProcessed: true,
                            llmBias: safeBias,
                            keywords: safeKeywords,
                            llmProcessingAttempts: (llmProcessingAttempts || 0) + 1,
                            llmProcessedAt: new Date()
                        }
                    },
                    upsert: false // Keep as false, we only update existing items
                }
            };
        });

    // Use a more accurate log message name
    console.log(`[task_finish ${batchId}] Mapped operations count: ${operations.length}`);

    if (operations.length > 0) {
        try {
            console.log(`[task_finish ${batchId}] Attempting bulkWrite with ${operations.length} operations...`);
            // Log the first operation to check its structure
            // console.log(`[task_finish ${batchId}] First operation sample:`, JSON.stringify(operations[0], null, 2));
            
            const bulkResult = await NewsItem.bulkWrite(operations, { ordered: false });
            console.log(`[task_finish ${batchId}] BulkWrite successful: Matched=${bulkResult.matchedCount}, Modified=${bulkResult.modifiedCount}, Upserted=${bulkResult.upsertedCount}`);
            // Increment success counter
            processedArticleCounter.inc(operations.length);
        } catch (error) {
            console.error(`[task_finish ${batchId}] Error during bulkWrite:`, error);
             // Optionally log the operations that failed if the error seems related to specific data
             // console.error(`[task_finish ${batchId}] Failed operations sample:`, JSON.stringify(operations.slice(0, 5), null, 2));
             // Increment failure counter (might count whole batch as failed)
             failedArticleCounter.inc(operations.length);
        }
    } else {
        console.log(`No operations to save for batch ${batchId}. Filtered out ${totalProcessed} items.`);
    }
};

// Attach the completion handler
llmQueue.on('completed', task_finish);
// ... rest of file 