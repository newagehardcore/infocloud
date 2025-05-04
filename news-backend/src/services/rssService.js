const { getDB } = require('../config/db');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); // Load .env from backend root
const sourceManagementService = require('./sourceManagementService');
const he = require('he'); // HTML entity decoder

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
 * Fetches unread entries from Miniflux, maps them, saves to DB, and marks as read.
 */
const fetchAndProcessMinifluxEntries = async () => {
  console.log(`[RSS Service] Starting Miniflux entry processing cycle.`);
  const db = getDB();
  const newsCollection = db.collection('newsitems');
  let sourceMapById = {};
  let sourceMapByUrl = {}; // Secondary map for URL lookup
  let unreadEntries = [];
  let entryIdsToMarkRead = [];

  // 1. Load sources into maps for quick lookup (by ID and URL)
  try {
    const sources = await sourceManagementService.loadSources();

    sources.forEach(source => {
      // Map by Miniflux ID if available
      if (source.minifluxFeedId) { 
        sourceMapById[source.minifluxFeedId] = source;
      }

      // Always map by URL (normalize URL slightly for better matching)
      if (source.url) {
          const normalizedUrl = source.url.trim().replace(/\/$/, ''); // Trim and remove trailing slash
          sourceMapByUrl[normalizedUrl] = source;
      }
    });

    console.log(`[RSS Service] Loaded ${sources.length} sources into maps (${Object.keys(sourceMapById).length} by ID, ${Object.keys(sourceMapByUrl).length} by URL).`);
  } catch (error) {
    console.error("[RSS Service] Failed to load sources:" , error);
    return; // Cannot proceed without sources
  }

  // 2. Fetch unread entries from Miniflux
  try {
    console.log(`[RSS Service] Fetching up to ${MAX_ENTRIES_PER_FETCH} unread entries from Miniflux...`);
    const response = await minifluxClient.get('/v1/entries', {
      params: {
        status: 'unread',
        order: 'published_at', // Process oldest unread first
        direction: 'asc',      // to maintain chronology when displaying
        limit: MAX_ENTRIES_PER_FETCH
      }
    });
    unreadEntries = response.data?.entries || [];
    console.log(`[RSS Service] Found ${unreadEntries.length} unread entries.`);
  } catch (error) {
    console.error(`[RSS Service] Failed to fetch entries from Miniflux: ${error.message}`);
    return; // Cannot proceed
  }

  if (unreadEntries.length === 0) {
    console.log('[RSS Service] No unread entries to process.');
    return;
  }

  // 3. Map entries and prepare bulk operations
  const bulkOps = [];
  let mappedCount = 0;
  for (const entry of unreadEntries) {
    let sourceInfo = sourceMapById[entry.feed_id]; // First, try lookup by feed_id

    // If not found by ID, try finding by the feed's URL from Miniflux data
    if (!sourceInfo && entry.feed?.feed_url) {
        const normalizedFeedUrl = entry.feed.feed_url.trim().replace(/\/$/, '');
        sourceInfo = sourceMapByUrl[normalizedFeedUrl];
        if (sourceInfo) {
            // Optional: Log that we found it via URL
            // console.log(`[RSS Service] Found source for feed ID ${entry.feed_id} via URL lookup: ${normalizedFeedUrl}`);
            // Potential improvement: Update the minifluxFeedId in master_sources.json here?
        }
    }

    if (!sourceInfo) {
      console.warn(`[RSS Service] No source info found for Miniflux feed ID ${entry.feed_id} (URL: ${entry.feed?.feed_url}). Skipping.`);
      // Consider marking as read anyway to avoid reprocessing?
      entryIdsToMarkRead.push(entry.id); // Add to mark as read even if skipped
      continue;
    }

    const newsItem = mapMinifluxEntryToNewsItem(entry, sourceInfo);
    if (newsItem) {
      bulkOps.push({
        updateOne: {
          filter: { id: newsItem.id }, // Use entry hash/ID as the unique key
          update: { $setOnInsert: newsItem },
          upsert: true
        }
      });
      entryIdsToMarkRead.push(entry.id);
      mappedCount++;
    }
     else {
        // If mapping failed, still mark as read to prevent reprocessing loop
        entryIdsToMarkRead.push(entry.id);
     }
  }
  console.log(`[RSS Service] Mapped ${mappedCount} entries for DB upsert.`);

  // 4. Perform Bulk DB Update
  if (bulkOps.length > 0) {
    try {
      const result = await newsCollection.bulkWrite(bulkOps, { ordered: false });
      console.log(`[DB] Upserted ${result.upsertedCount} new items via Miniflux. Matched: ${result.matchedCount}`);

      // 5. Mark entries as read in Miniflux ONLY if DB write was successful (or at least attempted)
      try {
        console.log(`[RSS Service] Marking ${entryIdsToMarkRead.length} entries as read in Miniflux...`);
        await minifluxClient.put('/v1/entries', { // Endpoint expects PUT
          entry_ids: entryIdsToMarkRead,
          status: 'read'
        });
        console.log(`[RSS Service] Successfully marked ${entryIdsToMarkRead.length} entries as read.`);
      } catch (minifluxError) {
        console.error(`[RSS Service] Failed to mark entries as read in Miniflux: ${minifluxError.message}. Entry IDs:`, entryIdsToMarkRead);
        // This is problematic - entries might be reprocessed. Requires monitoring or a retry mechanism.
      }

    } catch (dbError) {
      console.error(`[DB] Error during bulk write for Miniflux entries:`, dbError);
      if (dbError.code === 11000) {
        console.warn(`[DB] Duplicate key error during Miniflux bulk write. Some items likely already existed.`);
      }
      // Do NOT mark as read if DB write fails significantly
    }
  }
  else {
      console.log("[RSS Service] No valid operations for DB bulk write.");
      // Still mark skipped/failed mapping entries as read if any exist
       if (entryIdsToMarkRead.length > 0) {
            try {
                console.log(`[RSS Service] Marking ${entryIdsToMarkRead.length} skipped/failed entries as read in Miniflux...`);
                await minifluxClient.put('/v1/entries', { entry_ids: entryIdsToMarkRead, status: 'read' });
                console.log(`[RSS Service] Successfully marked ${entryIdsToMarkRead.length} skipped/failed entries as read.`);
            } catch (minifluxError) {
                console.error(`[RSS Service] Failed to mark skipped/failed entries as read in Miniflux: ${minifluxError.message}. Entry IDs:`, entryIdsToMarkRead);
            }
       }
  }

  console.log(`[RSS Service] Finished Miniflux entry processing cycle.`);
};

// Export the primary function for fetching/processing
module.exports = {
  fetchAndProcessMinifluxEntries
};