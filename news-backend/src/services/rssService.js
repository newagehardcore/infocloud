const fs = require('fs').promises; // <--- Add fs.promises
const { getDB } = require('../config/db');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); // Load .env from backend root

// --- REMOVE CACHE CLEARING ---
// try {
//     delete require.cache[require.resolve('./sourceManagementService')];
//     console.log('[RSS Service - Cache] Cleared cache for sourceManagementService.');
// } catch (e) {
//     console.warn('[RSS Service - Cache] Could not clear cache for sourceManagementService:', e);
// }
const sourceManagementService = require('./sourceManagementService');
// --- END REMOVE CACHE CLEARING ---

const he = require('he'); // HTML entity decoder
const NewsItem = require('../models/NewsItem');
const { PoliticalBias } = require('../types');
const { stripHtml } = require('../utils/textUtils'); // <<< Import from textUtils
const mongoose = require('mongoose');

// Function to convert uppercase bias (from Source model) to title case (for NewsItem model)
function getTitleCaseBias(uppercaseBias) {
  if (!uppercaseBias) return PoliticalBias.Unknown; // Default if input is undefined/null
  // Find the key in PoliticalBias enum whose uppercase version matches the input bias
  const foundKey = Object.keys(PoliticalBias).find(key => key.toUpperCase() === uppercaseBias.toUpperCase());
  // Return the corresponding TitleCase value, or Unknown if not found
  return foundKey ? PoliticalBias[foundKey] : PoliticalBias.Unknown;
}

// --- Miniflux Client Configuration ---
// Duplicated from sourceManagementService - consider refactoring to a shared module
const minifluxClient = axios.create({
  baseURL: process.env.MINIFLUX_URL,
  headers: {
    'X-Auth-Token': process.env.MINIFLUX_API_KEY || process.env.MINIFLUX_PASSWORD
  },
  timeout: 15000 // Increased timeout slightly for potentially larger entry fetches
});

const MAX_ENTRIES_PER_FETCH = 1000; // Limit how many entries to process at once
const MAX_DESC_LENGTH = 500; // Max length for description

/**
 * Cleans HTML content from Miniflux entries.
 * Basic cleaning: remove tags, decode entities, trim.
 * @param {string} htmlContent
 * @returns {string}
 */
function cleanHtmlContent(htmlContent) {
  if (!htmlContent) return '';
  let text = htmlContent.replace(/<[^>]*>?/gm, ''); // Remove HTML tags
  text = he.decode(text); // Decode HTML entities
  text = text.replace(/\s+/g, ' ').trim(); // Normalize whitespace
  return text;
}

/**
 * Maps a Miniflux entry and its source info to our NewsItem schema.
 * @param {object} entry - Miniflux entry object
 * @param {object} sourceInfo - Corresponding source info (from MongoDB via sourceManagementService)
 * @returns {object|null} NewsItem object or null if mapping fails
 */
function mapMinifluxEntryToNewsItem(entry, sourceInfo) {
  try {
    const cleanedContent = entry.content ? cleanHtmlContent(entry.content) : '';

    if (!entry || !sourceInfo || 
        !entry.id || !entry.feed_id || !entry.url || !entry.title || 
        !cleanedContent || cleanedContent.trim() === '' || // Explicitly check cleanedContent
        !sourceInfo.category || sourceInfo.category.trim() === '') {
      console.warn(`[RSS Service - mapMinifluxEntryToNewsItem] Skipping entry due to missing essential fields (id, feed_id, url, title), empty cleanedContent, missing sourceInfo, or empty/invalid source category. Entry ID: ${entry?.id}, Feed ID: ${entry?.feed_id}, Source Category: ${sourceInfo?.category}, CleanedContent Empty: ${!cleanedContent || cleanedContent.trim() === ''}`);
      return null;
    }

    const id = entry.hash || `miniflux-${entry.id}`;
    const title = he.decode(entry.title).trim();
    let description = cleanedContent;
    const url = entry.url;
    let publishedAt = entry.published_at;

    // Truncate description if excessively long
    if (description.length > MAX_DESC_LENGTH) {
      description = description.substring(0, MAX_DESC_LENGTH) + '...';
    }

    // Validate and format date
    try {
      publishedAt = new Date(publishedAt).toISOString();
    } catch (e) {
      console.warn(`[RSS Service] Invalid date format for entry ${id}: ${entry.published_at}. Using current time.`);
      publishedAt = new Date().toISOString();
    }

    // --- Add new log here ---
    console.log(`[RSS Service - mapMinifluxEntryToNewsItem] PRE-SAVE CHECK for Miniflux Entry ID ${entry?.id}: cleanedContent (first 70 chars): '${cleanedContent.substring(0,70)}', title: '${title}'`);
    // --- End new log ---

    const mappedSourceBias = getTitleCaseBias(sourceInfo.bias);

    const newsItem = {
      id, // Use Miniflux entry hash or ID as our primary key
      title,
      contentSnippet: description,
      url,
      source: {
        name: sourceInfo.name,
        bias: mappedSourceBias, // Use the title-cased bias
        category: sourceInfo.category, 
      },
      publishedAt,
      keywords: [], // Keywords will be added by a later process
      minifluxEntryId: entry.id.toString(), // Ensure it's a string for consistency
      minifluxFeedId: entry.feed_id.toString() // Ensure it's a string for consistency
    };

    return newsItem;

  } catch (error) {
    console.error(`[RSS Service] Error mapping Miniflux entry ID ${entry?.id}:`, error);
    return null;
  }
}

/**
 * Fetches recent entries (e.g., last 7 days) from ALL feeds in Miniflux,
 * regardless of read status, and upserts them into the database.
 * This triggers a full refresh, allowing background LLM processing to catch up.
 *
 * @returns {Promise<{ processedCount: number, errorCount: number, skippedCount: number }>} - Count of processed, errored, and skipped items.
 */
async function forceRefreshAllFeeds() {
  console.log('[RSS Service] Starting Force Refresh...');
  let sources = [];
  try {
    sources = await sourceManagementService.getAllSources();
  } catch (err) {
    console.error('[RSS Service] Force Refresh Error: Failed to load sources:', err);
    return { processedCount: 0, errorCount: 1, skippedCount: 0 };
  }

  if (!sources || sources.length === 0) {
    console.warn('[RSS Service] Force Refresh Warning: No sources found in DB. Cannot process entries.');
    return { processedCount: 0, errorCount: 0, skippedCount: 0 };
  }

  const minifluxUrl = process.env.MINIFLUX_URL;
  const minifluxApiKey = process.env.MINIFLUX_API_KEY;

  if (!minifluxUrl || !minifluxApiKey) {
    console.error('[RSS Service] Force Refresh Error: Miniflux URL or API Key not configured.');
    return { processedCount: 0, errorCount: 0, skippedCount: 0 };
  }

  const headers = { 'X-Auth-Token': minifluxApiKey };
  let processedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  const sourceMap = new Map();
  sources.forEach(s => {
    // Ensure source has minifluxFeedId (use correct camelCase) and a non-empty category
    if (s.minifluxFeedId && s.category && s.category.trim() !== '') {
      sourceMap.set(s.minifluxFeedId.toString(), s);
    } else {
      console.warn(`[RSS Service - ForceRefresh SourceMap] Skipping source "${s.name}" (DB ID: ${s._id}, UUID: ${s.id}) from sourceMap due to missing minifluxFeedId or empty category. FeedID: ${s.minifluxFeedId}, Category: ${s.category}`);
    }
  });

  if (sourceMap.size === 0) {
    console.warn('[RSS Service] Force Refresh Warning: No valid sources with minifluxFeedId and category found to create sourceMap. Cannot process entries.');
    return { processedCount: 0, errorCount: 0, skippedCount: 0 };
  }

  try {
    const feedsResponse = await axios.get(`${minifluxUrl}/v1/feeds`, { headers });
    const feedIds = feedsResponse.data.map(feed => feed.id);
    console.log(`[RSS Service] Force Refresh: Found ${feedIds.length} feeds in Miniflux.`);

    // 2. Fetch recent entries for each feed
    const allEntries = [];
    console.log(`[RSS Service] Force Refresh: Starting to fetch entries for ${feedIds.length} feeds...`);
    for (const feedId of feedIds) {
        console.log(`[RSS Service] Force Refresh: Fetching entries for feed ID: ${feedId}`);
        try {
            const entriesResponse = await axios.get(
                `${minifluxUrl}/v1/feeds/${feedId}/entries`,
                {
                    headers,
                    params: {
                        order: 'published_at',
                        direction: 'desc',
                        limit: 100
                    }
                }
            );

            const entries = entriesResponse.data.entries || [];
            console.log(`[RSS Service] Force Refresh: Feed ${feedId} raw fetch count: ${entries.length}`);
            
            const recentEntries = entries.filter(entry =>
                new Date(entry.published_at) >= cutoffDate
            );
            allEntries.push(...recentEntries);

        } catch (feedError) {
            console.error(`[RSS Service] Force Refresh Error: Failed to fetch entries for feed ${feedId}:`, feedError.message);
            errorCount++; // Count feed-level errors
        }
        // Add a small delay to avoid hammering the API
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`[RSS Service] Force Refresh: Fetched a total of ${allEntries.length} entries within the last 7 days from all feeds.`);

    if (allEntries.length === 0) {
      console.log('[RSS Service] Force Refresh: No recent entries found to process.');
      return { processedCount, errorCount, skippedCount };
    }

    // 3. Prepare entries for bulk upsert
    const bulkOps = []; // Initialize as an empty array

    allEntries.forEach(entry => {
      if (!entry.feed_id) {
        console.warn(`[RSS Service - ForceRefresh] Skipping entry (Miniflux Entry ID: ${entry.id}, URL: ${entry.url}) due to missing feed_id in Miniflux data.`);
        skippedCount++;
        return; // Skip this entry
      }
      const sourceInfo = sourceMap.get(entry.feed_id.toString());

      if (!sourceInfo) {
        console.warn(`[RSS Service - ForceRefresh] No source info found in sourceMap for Miniflux Feed ID: ${entry.feed_id} (Entry ID: ${entry.id}, URL: ${entry.url}). Skipping entry. Ensure a Source exists in DB with this minifluxFeedId and has a category.`);
        skippedCount++;
        return; // Skip this entry
      }

      // mapMinifluxEntryToNewsItem will perform the final check on sourceInfo.category
      const newsItemData = mapMinifluxEntryToNewsItem(entry, sourceInfo);

      if (!newsItemData) {
        // mapMinifluxEntryToNewsItem already logged the reason for skipping (e.g. empty category)
        skippedCount++;
        return; // Skip this entry
      }
      
      // Ensure source sub-document is correctly populated based on the (now corrected) newsItemData from mapMinifluxEntryToNewsItem
      newsItemData.source = {
          name: sourceInfo.name,
          bias: getTitleCaseBias(sourceInfo.bias),   // Use the title-cased bias
          category: sourceInfo.category
      };

      // Reset processing status so they get picked up by LLM queue
      newsItemData.llmProcessed = false;
      newsItemData.llmProcessingError = null;
      newsItemData.llmProcessingAttempts = 0;
      newsItemData.keywords = []; 
      newsItemData.bias = PoliticalBias.Unknown; // Reset bias; let LLM reprocess

      bulkOps.push({
        updateOne: {
          filter: { minifluxEntryId: entry.id.toString() },
          update: { $set: newsItemData },
          upsert: true
        }
      });
    });

    console.log(`[RSS Service] Force Refresh: Total entries to process: ${bulkOps.length}, Skipped: ${skippedCount}`);

    // 4. Execute Bulk Upsert in Batches
    const batchSize = 20; // Process 20 operations at a time (Reduced further)
    console.log(`[RSS Service] Force Refresh: Preparing to process ${bulkOps.length} operations in batches of ${batchSize}...`);

    for (let i = 0; i < bulkOps.length; i += batchSize) {
      const batch = bulkOps.slice(i, i + batchSize);
      console.log(`[RSS Service] Force Refresh: Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(bulkOps.length / batchSize)} (Size: ${batch.length})`);
      
      if (batch.length > 0) {
        try {
          const result = await NewsItem.bulkWrite(batch, { ordered: false });
          const batchProcessed = result.upsertedCount + result.modifiedCount;
          const batchErrors = result.writeErrors?.length || 0;
          processedCount += batchProcessed;
          errorCount += batchErrors;
          console.log(`[RSS Service] Force Refresh: Batch complete. Processed in batch: ${batchProcessed}, Errors in batch: ${batchErrors}`);
        } catch (batchError) {
            console.error(`[RSS Service] Force Refresh: Error during bulkWrite batch ${Math.floor(i / batchSize) + 1}:`, batchError);
            errorCount += batch.length; // Assume all items in the failed batch errored
        }
      } else {
        console.log(`[RSS Service] Force Refresh: Skipping empty batch.`);
      }
       // Optional: Add a small delay between batches if needed, e.g., await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`[RSS Service] Force Refresh: Finished processing all batches.`);

  } catch (error) {
    console.error('[RSS Service] Force Refresh: Critical error during processing:', error);
    errorCount++; // Increment general error count
  }
  console.log(`[RSS Service] Force Refresh Complete. Processed: ${processedCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);
  return { processedCount, errorCount, skippedCount };
}

/**
 * Fetches UNREAD entries from Miniflux, processes them, and marks them as read.
 * This is typically run by a cron job.
 */
async function fetchAndProcessMinifluxEntries() {
  console.log('[RSS Service] Starting Fetch & Process Unread Miniflux Entries...');
  let sources = [];
  try {
    sources = await sourceManagementService.getAllSources();
  } catch (err) {
    console.error('[RSS Service - FetchUnread] Error: Failed to load sources:', err);
    return { processedCount: 0, errorCount: 1, markedAsReadCount: 0, skippedCount: 0 };
  }

  if (!sources || sources.length === 0) {
    console.warn('[RSS Service - FetchUnread] Warning: No sources found in DB. Cannot process entries.');
    return { processedCount: 0, errorCount: 0, markedAsReadCount: 0, skippedCount: 0 };
  }

  const minifluxUrl = process.env.MINIFLUX_URL;
  const minifluxApiKey = process.env.MINIFLUX_API_KEY;

  if (!minifluxUrl || !minifluxApiKey) {
    console.error('[RSS Service - FetchUnread] Error: Miniflux URL or API Key not configured.');
    return { processedCount: 0, errorCount: 0, markedAsReadCount: 0, skippedCount: 0 };
  }

  const sourceCache = new Map();
  sources.forEach(s => {
    if (s.minifluxFeedId && s.category && s.category.trim() !== '') {
      sourceCache.set(s.minifluxFeedId.toString(), s);
    } else {
      console.warn(`[RSS Service - FetchUnread SourceCache] Skipping source "${s.name}" (DB ID: ${s._id}, UUID: ${s.id}) from sourceCache due to missing minifluxFeedId or empty category. FeedID: ${s.minifluxFeedId}, Category: ${s.category}`);
    }
  });
  
  if (sourceCache.size === 0) {
      console.warn('[RSS Service - FetchUnread] Warning: No valid sources with minifluxFeedId and category found to create sourceCache. Cannot process entries.');
      return { processedCount: 0, errorCount: 0, markedAsReadCount: 0, skippedCount: 0 };
  }

  let allUnreadEntries = [];
  let processedCount = 0;
  let errorCount = 0;
  let markedAsReadCount = 0;
  let skippedCount = 0; // Added for tracking skipped items

  try {
    console.log(`[RSS Service - FetchUnread] Fetching up to ${MAX_ENTRIES_PER_FETCH} unread entries from Miniflux...`);
    const response = await minifluxClient.get('/v1/entries', {
      params: {
        status: 'unread',
        limit: MAX_ENTRIES_PER_FETCH, // Fetch a limited number of entries
        direction: 'asc' // Process oldest first
      }
    });

    allUnreadEntries = response.data.entries || [];
    console.log(`[RSS Service - FetchUnread] Found ${allUnreadEntries.length} unread entries.`);

    if (allUnreadEntries.length === 0) {
      console.log('[RSS Service - FetchUnread] No unread entries to process.');
      return { processedCount, errorCount, markedAsReadCount, skippedCount };
    }

    const bulkOps = [];
    const entryIdsToMarkRead = [];

    for (const entry of allUnreadEntries) {
      if (!entry.feed_id) {
        console.warn(`[RSS Service - FetchUnread] Skipping entry (Miniflux Entry ID: ${entry.id}) due to missing feed_id in Miniflux data.`);
        skippedCount++;
        entryIdsToMarkRead.push(entry.id);
        continue;
      }

      const sourceInfo = sourceCache.get(entry.feed_id.toString());

      if (!sourceInfo) {
        console.warn(`[RSS Service - FetchUnread] No source info found in cache for Miniflux Feed ID: ${entry.feed_id} (Entry ID: ${entry.id}, URL: ${entry.url}). Skipping entry. Ensure a Source exists in DB with this minifluxFeedId and has a category.`);
        skippedCount++;
        entryIdsToMarkRead.push(entry.id);
        continue; 
      }
      
      const newsItemDocument = mapMinifluxEntryToNewsItem(entry, sourceInfo);

      if (newsItemDocument) {
        // Ensure source sub-document is correctly populated based on the (now corrected) newsItemData from mapMinifluxEntryToNewsItem
        newsItemDocument.source = {
            name: sourceInfo.name,
            bias: getTitleCaseBias(sourceInfo.bias), // Use the title-cased bias
            category: sourceInfo.category
        };

        newsItemDocument.llmProcessed = false;
        newsItemDocument.llmProcessingError = null;
        newsItemDocument.llmProcessingAttempts = 0;
        newsItemDocument.keywords = []; 
        newsItemDocument.bias = PoliticalBias.Unknown; // Reset bias; let LLM reprocess

        bulkOps.push({
          updateOne: {
            filter: { minifluxEntryId: entry.id.toString() }, // Use Miniflux Entry ID for upsert filter
            update: { $set: newsItemDocument },
            upsert: true
          }
        });
        entryIdsToMarkRead.push(entry.id);
      } else {
        console.warn(`[RSS Service - FetchUnread] Failed to map Miniflux entry ID ${entry.id} to NewsItem. Skipping.`);
        skippedCount++;
        // Mark as read even if mapping failed to prevent loop on bad data
        entryIdsToMarkRead.push(entry.id);
      }
    }

    if (bulkOps.length > 0) {
      console.log(`[RSS Service - FetchUnread] Performing bulk upsert for ${bulkOps.length} NewsItems...`);
      // Execute Bulk Upsert in Batches
      const batchSize = 50; // Batch size for upserts
      for (let i = 0; i < bulkOps.length; i += batchSize) {
          const batch = bulkOps.slice(i, i + batchSize);
          try {
              const result = await NewsItem.bulkWrite(batch, { ordered: false });
              const batchProcessed = result.upsertedCount + result.modifiedCount;
              processedCount += batchProcessed;
              // Note: result.writeErrors might contain details on individual op errors if ordered:false
              if (result.writeErrors && result.writeErrors.length > 0) {
                  console.warn(`[RSS Service - FetchUnread] ${result.writeErrors.length} errors during bulkWrite batch.`);
                  errorCount += result.writeErrors.length;
              }
              console.log(`[RSS Service - FetchUnread] Batch upsert complete. Processed in batch: ${batchProcessed}`);
          } catch (batchError) {
              console.error(`[RSS Service - FetchUnread] Error during bulkWrite batch:`, batchError);
              errorCount += batch.length; // Assume all items in this batch failed
          }
      }
    } else {
      console.log('[RSS Service - FetchUnread] No valid NewsItems to upsert.');
    }

    // Mark entries as read in Miniflux
    if (entryIdsToMarkRead.length > 0) {
      console.log(`[RSS Service - FetchUnread] Marking ${entryIdsToMarkRead.length} entries as read in Miniflux...`);
      try {
        // Miniflux API expects an array of entry IDs (integers)
        await minifluxClient.put('/v1/entries', { entry_ids: entryIdsToMarkRead, status: 'read' });
        markedAsReadCount = entryIdsToMarkRead.length;
        console.log(`[RSS Service - FetchUnread] Successfully marked ${markedAsReadCount} entries as read.`);
      } catch (markReadError) {
        console.error('[RSS Service - FetchUnread] Error marking entries as read in Miniflux:', markReadError.response ? markReadError.response.data : markReadError.message);
        // Don't increment main errorCount for this, as items might have been processed successfully
      }
    }

  } catch (error) {
    console.error('[RSS Service - FetchUnread] Error fetching or processing unread entries:', error.response ? error.response.data : error.message, error.stack);
    errorCount++;
  }

  console.log(`[RSS Service - FetchUnread] Fetch & Process Unread Complete. Items Processed (Upserted/Modified): ${processedCount}, Items Skipped: ${skippedCount}, Marked as Read: ${markedAsReadCount}, Errors: ${errorCount}`);
  return { processedCount, errorCount, markedAsReadCount, skippedCount };
}

// Export the primary function for fetching/processing
module.exports = {
  fetchAndProcessMinifluxEntries,
  forceRefreshAllFeeds
};