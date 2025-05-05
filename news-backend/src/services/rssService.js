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
const { stripHtml } = require('./wordProcessingService'); // Import stripHtml
const mongoose = require('mongoose');

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
 * @param {object} sourceInfo - Corresponding source info from master_sources.json
 * @returns {object|null} NewsItem object or null if mapping fails
 */
function mapMinifluxEntryToNewsItem(entry, sourceInfo) {
  try {
    if (!entry || !sourceInfo || !entry.id || !entry.feed_id || !entry.url || !entry.title) {
      console.warn(`[RSS Service] Skipping entry due to missing essential fields:`, entry?.id, entry?.feed_id);
      return null;
    }

    const id = entry.hash || `miniflux-${entry.id}`; // Use hash for content ID if available, fallback to entry ID
    const title = he.decode(entry.title).trim();
    let description = cleanHtmlContent(entry.content);
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

    const newsItem = {
      id, // Use Miniflux entry hash or ID as our primary key
      title,
      description,
      url,
      source: {
        name: sourceInfo.name,
        bias: sourceInfo.bias,
      },
      publishedAt,
      category: sourceInfo.category,
      keywords: [], // Keywords will be added by a later process
      minifluxEntryId: entry.id, // Keep original Miniflux entry ID for reference/marking as read
      minifluxFeedId: entry.feed_id // Keep original Miniflux feed ID for reference
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
 * @returns {Promise<{ processedCount: number, errorCount: number }>} - Count of processed and errored items.
 */
async function forceRefreshAllFeeds() {
  console.log('[RSS Service] Starting Force Refresh...');
  let sources = [];
  try {
    sources = await sourceManagementService.loadSources(); // Await the async call
  } catch (err) {
    console.error('[RSS Service] Force Refresh Error: Failed to load sources:', err);
    return { processedCount: 0, errorCount: 1 }; // Return error if loading fails
  }

  if (!sources || sources.length === 0) {
    console.error('[RSS Service] Force Refresh Error: No sources found in master_sources.json or loading failed.');
    return { processedCount: 0, errorCount: 0 };
  }

  const minifluxUrl = process.env.MINIFLUX_URL;
  const minifluxApiKey = process.env.MINIFLUX_API_KEY;

  if (!minifluxUrl || !minifluxApiKey) {
    console.error('[RSS Service] Force Refresh Error: Miniflux URL or API Key not configured.');
    return { processedCount: 0, errorCount: 0 };
  }

  const headers = { 'X-Auth-Token': minifluxApiKey };
  let processedCount = 0;
  let errorCount = 0;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7); // Fetch articles from the last 7 days

  // Map source IDs to their metadata for quick lookup
  const sourceMap = new Map(sources.map(s => [s.miniflux_feed_id?.toString(), s]));

  try {
    // 1. Get all feed IDs from Miniflux
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
      return { processedCount: 0, errorCount };
    }

    // 3. Prepare entries for bulk upsert
    const bulkOps = allEntries.map(entry => {
      const sourceInfo = sourceMap.get(entry.feed_id?.toString());
      const bias = sourceInfo?.bias || PoliticalBias.Unknown;
      const category = sourceInfo?.category || 'Unknown';
      const sourceName = sourceInfo?.name || entry.feed.title || 'Unknown Source';

      // Basic content cleaning (similar to fetchAndProcess)
      const cleanedDescription = stripHtml(entry.content || '');

      const newsItemData = {
        title: entry.title || '',
        url: entry.url || '',
        contentSnippet: cleanedDescription.substring(0, 250), // Store snippet
        publishedAt: new Date(entry.published_at),
        minifluxEntryId: entry.id.toString(),
        minifluxFeedId: entry.feed_id.toString(),
        source: {
          name: sourceName,
          category: category,
          bias: bias
        },
        // Reset processing status so they get picked up by LLM queue
        llmProcessed: false,
        llmProcessingError: null,
        llmProcessingAttempts: 0,
        keywords: [], // Clear keywords; let LLM reprocess
        bias: PoliticalBias.Unknown // Reset bias; let LLM reprocess
      };

      return {
        updateOne: {
          filter: { minifluxEntryId: entry.id.toString() },
          update: { $set: newsItemData },
          upsert: true
        }
      };
    });

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
    console.error('[RSS Service] Force Refresh Error during main process:', error);
    if (error && error.stack) {
        console.error("Stack Trace:", error.stack);
    }
    if (errorCount === 0 && processedCount === 0) errorCount = 1; // Mark at least one error if nothing else was caught
  }

  console.log(`[RSS Service] Force Refresh finished. Total processed/upserted: ${processedCount}, Total errors: ${errorCount}`);
  return { processedCount, errorCount };
}

/**
 * Fetches UNREAD entries from Miniflux, enriches them, and saves to DB.
 * Marks fetched entries as read in Miniflux.
 */
async function fetchAndProcessMinifluxEntries() {
  console.log('[RSS Service] Starting Miniflux entry fetch...');
  let sources = [];
  try {
    sources = await sourceManagementService.loadSources();
    
    // Keep the basic source count log
    console.log(`[RSS Service] Loaded ${sources.length} sources via service for processing.`); 
    // --- REMOVE Debug Check Logging --- 
    // if (sources && sources.length > 0) {
    //     console.log(`[RSS Service - Debug Check] First source object received: ${JSON.stringify(sources[0], null, 2)}`);
    //     console.log(`[RSS Service - Debug Check] Type of sources[0].minifluxFeedId: ${typeof sources[0].minifluxFeedId}`);
    //     console.log(`[RSS Service - Debug Check] Value of sources[0].minifluxFeedId: ${sources[0].minifluxFeedId}`);
    // }
    // --- END REMOVE Debug Check Logging ---

    // --- Revert to original filter check --- 
    const sourcesWithoutFeedId = sources.filter(s => s.minifluxFeedId === null || s.minifluxFeedId === undefined);

    // --- REMOVE Manual loop --- 
    // const sourcesWithoutFeedId = [];
    // for (const source of sources) {
    //     if (sources.indexOf(source) < 5) {
    //         console.log(`[RSS Service - Loop Check ${sources.indexOf(source)}] ID: ${source.id}, FeedId value: ${source.minifluxFeedId}, Type: ${typeof source.minifluxFeedId}`);
    //     }
    //     if (!source.minifluxFeedId) { 
    //         sourcesWithoutFeedId.push(source);
    //     }
    // }
    // --- End replacement --- 

    // Revert warning log if needed (or keep simplified version)
    if (sourcesWithoutFeedId.length > 0) {
      console.warn(`[RSS Service] WARNING: Found ${sourcesWithoutFeedId.length} sources missing 'miniflux_feed_id'. Check master_sources.json and run sync script if necessary.`, 
                   sourcesWithoutFeedId.slice(0, 5).map(s => ({ id: s.id, name: s.name, url: s.url })) // Log first 5 problematic items
      );
    }
    // Check for non-string/number types (keep this check)
    const sourcesWithNonStringOrNumberId = sources.filter(s => 
        s.minifluxFeedId !== null && 
        s.minifluxFeedId !== undefined && 
        typeof s.minifluxFeedId !== 'string' && 
        typeof s.minifluxFeedId !== 'number'
    );
    if (sourcesWithNonStringOrNumberId.length > 0) {
      console.warn(`[RSS Service] WARNING: Found ${sourcesWithNonStringOrNumberId.length} sources with unexpected type for 'miniflux_feed_id':`,
                   sourcesWithNonStringOrNumberId.map(s => ({ id: s.id, name: s.name, feedIdType: typeof s.minifluxFeedId }))
      );
    }
  } catch (err) {
    console.error('[RSS Service] Fatal Error: Failed to load sources via service:', err);
    return { processedCount: 0, errorCount: 0, markedAsReadCount: 0 }; 
  }
  
  if (!sources || sources.length === 0) {
    console.error('[RSS Service] Error: No sources found or loading failed.');
    return { processedCount: 0, errorCount: 0, markedAsReadCount: 0 };
  }

  const minifluxUrl = process.env.MINIFLUX_URL;
  const minifluxApiKey = process.env.MINIFLUX_API_KEY;

  if (!minifluxUrl || !minifluxApiKey) {
    console.error('[RSS Service] Error: Miniflux URL or API Key not configured.');
    return { processedCount: 0, errorCount: 0, markedAsReadCount: 0 };
  }

  const headers = { 'X-Auth-Token': minifluxApiKey };
  let processedCount = 0;
  let errorCount = 0;
  let markedAsReadCount = 0;

  // --- REMOVE Map creation logs --- 
  // const mapInput = sources.map(s => {
  //     const key = s.minifluxFeedId?.toString(); 
  //     // if (sources.indexOf(s) < 5) {
  //     //     console.log(`[RSS Service - Map Key Gen ${sources.indexOf(s)}] ID: ${s.id}, FeedId value: ${s.minifluxFeedId}, Generated Key: ${key}, Key Type: ${typeof key}`);
  //     // }
  //     return [key, s];
  // });
  // console.log(`[RSS Service - Map Input] First 5 pairs: ${JSON.stringify(mapInput.slice(0, 5).map(pair => ({ key: pair[0], sourceId: pair[1].id })), null, 2)}`);
  const sourceMap = new Map(sources.map(s => [s.minifluxFeedId?.toString(), s])); 
  // console.log(`[RSS Service - Map Result] Final Map Keys:`, Array.from(sourceMap.keys()).slice(0, 20));
  // --- END REMOVE Map creation logs --- 

  try {
    console.log('[RSS Service] Fetching latest entries from Miniflux...');
    const entriesResponse = await axios.get(`${minifluxUrl}/v1/entries`, {
      headers,
      params: {
        status: 'unread', 
        order: 'published_at',
        direction: 'desc',
        limit: 500 
      }
    });

    const entries = entriesResponse.data.entries || [];
    const unreadEntries = entries; 
    const entryIdsToMarkRead = [];

    console.log(`[RSS Service] Found ${unreadEntries.length} unread entries.`);

    if (unreadEntries.length === 0) {
      console.log('[RSS Service] No unread entries found.');
      return { processedCount: 0, errorCount: 0, markedAsReadCount: 0 };
    }

    const bulkOps = [];
    unreadEntries.forEach((entry, idx) => {
      const feedIdString = entry.feed_id?.toString();
      const sourceInfo = sourceMap.get(feedIdString);

      // --- REMOVE Loop Debug Logging ---
      // if (idx < 10) { 
      //     console.log(`[RSS Service Loop Debug] Entry ${idx}: ID=${entry.id}, FeedID=${entry.feed_id}, FeedIDString=${feedIdString}, FoundSource=${!!sourceInfo}`);
      //     if (!sourceInfo) {
      //         if (idx === 0) { 
      //             console.log(`[RSS Service Loop Debug] SourceMap Keys:`, Array.from(sourceMap.keys()).slice(0, 20)); 
      //         }
      //     }
      // }
      // --- END REMOVE Loop Debug Logging ---

      if (sourceInfo) {
        const bias = sourceInfo.bias || PoliticalBias.Unknown;
        const category = sourceInfo.category || 'Unknown';
        const sourceName = sourceInfo.name || entry.feed.title || 'Unknown Source';

        // Basic content cleaning
        const cleanedDescription = stripHtml(entry.content || '');

        const newsItemData = {
          title: entry.title || '',
          url: entry.url || '',
          contentSnippet: cleanedDescription.substring(0, 250), // Store snippet
          publishedAt: new Date(entry.published_at),
          minifluxEntryId: entry.id.toString(),
          minifluxFeedId: entry.feed_id.toString(),
          source: {
            name: sourceName,
            category: category,
            bias: bias
          },
          // Mark as unprocessed for LLM queue
          llmProcessed: false,
          llmProcessingError: null,
          llmProcessingAttempts: 0,
          keywords: [],
          bias: PoliticalBias.Unknown
        };

        bulkOps.push({
          updateOne: {
            filter: { minifluxEntryId: entry.id.toString() },
            update: { $set: newsItemData },
            upsert: true
          }
        });
        entryIdsToMarkRead.push(entry.id);
      } else {
        // console.warn(`[RSS Service] Skipping entry ${entry.id} from feed ${entry.feed_id}: No matching source found in master_sources.json.`);
        // Optionally mark these as read anyway to prevent re-fetching? Or leave unread.
        // Let's leave them unread for now.
      }
    });

    // Execute Bulk Upsert
    if (bulkOps.length > 0) {
      console.log(`[RSS Service] Performing bulk upsert of ${bulkOps.length} items...`);
      const result = await NewsItem.bulkWrite(bulkOps, { ordered: false });
      processedCount = result.upsertedCount + result.modifiedCount;
      errorCount = result.writeErrors?.length || 0;
      console.log(`[RSS Service] Bulk upsert complete. Processed: ${processedCount}, Errors: ${errorCount}`);
    } else {
        console.log('[RSS Service] No valid entries found to upsert after filtering by master sources.');
    }

    // Mark processed entries as read in Miniflux
    if (entryIdsToMarkRead.length > 0) {
      console.log(`[RSS Service] Marking ${entryIdsToMarkRead.length} entries as read in Miniflux...`);
      try {
        await axios.put(
          `${minifluxUrl}/v1/entries`,
          { entry_ids: entryIdsToMarkRead, status: 'read' },
          { headers }
        );
        markedAsReadCount = entryIdsToMarkRead.length;
        console.log(`[RSS Service] Successfully marked ${markedAsReadCount} entries as read.`);
      } catch (markReadError) {
        console.error('[RSS Service] Error marking entries as read:', markReadError.message);
        // Don't increment main error count here, as upsert might have succeeded
      }
    }

  } catch (error) {
    console.error('[RSS Service] Error fetching or processing Miniflux entries:', error);
    errorCount++; // Increment error count for general fetch/process failure
  }

  console.log(`[RSS Service] Miniflux entry fetch finished. Processed: ${processedCount}, Errors: ${errorCount}, Marked as Read: ${markedAsReadCount}`);
  return { processedCount, errorCount, markedAsReadCount };
}

// Export the primary function for fetching/processing
module.exports = {
  fetchAndProcessMinifluxEntries,
  forceRefreshAllFeeds
};