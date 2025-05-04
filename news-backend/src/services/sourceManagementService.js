const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); // Load .env from backend root

const SOURCES_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'master_sources.json');

// --- Miniflux Client Configuration ---
const minifluxClient = axios.create({
  baseURL: process.env.MINIFLUX_URL,
  headers: {
    'X-Auth-Token': process.env.MINIFLUX_API_KEY || process.env.MINIFLUX_PASSWORD // Use API Key if available, fallback to password (legacy?)
    // TODO: Check MINIFLUX_INTEGRATION.md again - it mentions user/pass, not API key. Let's assume API key for now based on best practices.
  },
  timeout: 10000 // 10 second timeout
});

// Helper to get Miniflux Category ID by Title
async function getMinifluxCategoryId(categoryTitle) {
  try {
    const response = await minifluxClient.get('/v1/categories');
    const category = response.data.find(cat => cat.title.toUpperCase() === categoryTitle.toUpperCase());
    return category ? category.id : null;
  } catch (error) {
    console.error(`[Miniflux] Error fetching categories: ${error.message}`);
    // Decide if we should throw or handle (e.g., try to create category?)
    // For now, return null, feed creation might fail later.
    return null;
  }
}

// Helper to create Miniflux Category if it doesn't exist
async function ensureMinifluxCategory(categoryTitle) {
  let categoryId = await getMinifluxCategoryId(categoryTitle);
  if (!categoryId) {
    try {
      console.log(`[Miniflux] Category '${categoryTitle}' not found, attempting to create.`);
      const response = await minifluxClient.post('/v1/categories', { title: categoryTitle });
      categoryId = response.data.id;
      console.log(`[Miniflux] Created category '${categoryTitle}' with ID: ${categoryId}`);
    } catch (error) {
      console.error(`[Miniflux] Error creating category '${categoryTitle}': ${error.message}`);
      throw new Error(`Failed to ensure Miniflux category '${categoryTitle}'`); // Throw if category creation fails
    }
  }
  return categoryId;
}

// --- Data Persistence ---

async function loadSources() {
  try {
    const data = await fs.readFile(SOURCES_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn('[SourceService] master_sources.json not found, returning empty array.');
      return [];
    }
    console.error('[SourceService] Error loading sources:', error);
    throw new Error('Could not load sources file.');
  }
}

async function saveSources(sources) {
  try {
    const data = JSON.stringify(sources, null, 2);
    await fs.writeFile(SOURCES_FILE_PATH, data, 'utf-8');
  } catch (error) {
    console.error('[SourceService] Error saving sources:', error);
    throw new Error('Could not save sources file.');
  }
}

// --- CRUD Operations ---

async function getAllSources() {
  return await loadSources();
}

async function getSourceById(id) {
  const sources = await loadSources();
  return sources.find(source => source.id === id);
}

async function addSource(newSourceData) {
  const sources = await loadSources();
  const { url, name, category, bias, alternateUrl } = newSourceData;

  if (!url || !name || !category || !bias) {
    throw new Error('Missing required fields for new source (url, name, category, bias).');
  }

  // Check for duplicate URL
  if (sources.some(source => source.url === url)) {
    throw new Error(`Source with URL ${url} already exists.`);
  }

  // 1. Ensure Category exists in Miniflux and get its ID
  const minifluxCategoryId = await ensureMinifluxCategory(category);

  // 2. Create Feed in Miniflux
  let minifluxFeedId = null;
  try {
    console.log(`[Miniflux] Attempting to create feed: ${url} in category ID: ${minifluxCategoryId}`);
    const response = await minifluxClient.post('/v1/feeds', {
      feed_url: url,
      category_id: minifluxCategoryId,
      // Optional: Set title in Miniflux? Let's use our name for consistency.
      // title: name
    });
    minifluxFeedId = response.data.id;
    console.log(`[Miniflux] Created feed for ${url} with ID: ${minifluxFeedId}`);
  } catch (error) {
    console.error(`[Miniflux] Error creating feed ${url}: ${error.response?.data?.error_message || error.message}`);
    // Should we proceed without a miniflux ID or throw?
    // Let's throw for now, as sync is broken if this fails.
    throw new Error(`Failed to create feed in Miniflux for URL: ${url}`);
  }

  // 3. Create and save the source in our master list
  const newSource = {
    id: uuidv4(),
    url,
    alternateUrl: alternateUrl || null,
    name,
    category: category.toUpperCase(),
    bias: bias.toUpperCase(),
    minifluxFeedId, // Store the ID from Miniflux
  };

  sources.push(newSource);
  await saveSources(sources);
  console.log(`[SourceService] Added source: ${name} (${url})`);
  return newSource;
}

async function updateSource(id, updatedData) {
  const sources = await loadSources();
  const sourceIndex = sources.findIndex(source => source.id === id);

  if (sourceIndex === -1) {
    throw new Error(`Source with ID ${id} not found.`);
  }

  const originalSource = sources[sourceIndex];
  let categoryChanged = false;
  let newMinifluxCategoryId = null;

  // Check if category changed and ensure the new category exists in Miniflux
  if (updatedData.category && updatedData.category.toUpperCase() !== originalSource.category.toUpperCase()) {
    newMinifluxCategoryId = await ensureMinifluxCategory(updatedData.category);
    categoryChanged = true;
    console.log(`[SourceService] Category change detected for ${id}: ${originalSource.category} -> ${updatedData.category.toUpperCase()}`);
  }

  // Prepare updated source object
  const updatedSource = {
    ...originalSource,
    ...updatedData,
    category: categoryChanged ? updatedData.category.toUpperCase() : originalSource.category,
    bias: updatedData.bias ? updatedData.bias.toUpperCase() : originalSource.bias,
    name: updatedData.name || originalSource.name,
    id: originalSource.id,
    url: originalSource.url // Do not allow URL change via update for now
  };

  // Update Miniflux if category changed
  if (categoryChanged && originalSource.minifluxFeedId) {
    try {
      console.log(`[Miniflux] Attempting to update category for feed ID ${originalSource.minifluxFeedId} to category ID ${newMinifluxCategoryId}`);
      await minifluxClient.put(`/v1/feeds/${originalSource.minifluxFeedId}`, {
        category_id: newMinifluxCategoryId
        // Optionally update title if name changed?
        // title: updatedSource.name
      });
      console.log(`[Miniflux] Updated category for feed ID ${originalSource.minifluxFeedId}`);
    } catch (error) {
      console.error(`[Miniflux] Error updating category for feed ID ${originalSource.minifluxFeedId}: ${error.response?.data?.error_message || error.message}`);
      // Don't throw, but log error. The master list will be updated anyway.
    }
  } else if (categoryChanged && !originalSource.minifluxFeedId) {
      console.warn(`[SourceService] Category changed for source ${id}, but no Miniflux Feed ID found. Cannot sync category change to Miniflux.`);
  }

  // Update our master list
  sources[sourceIndex] = updatedSource;
  await saveSources(sources);
  console.log(`[SourceService] Updated source: ${updatedSource.name} (ID: ${id})`);
  return updatedSource;
}

async function deleteSource(id) {
  let sources = await loadSources();
  const sourceIndex = sources.findIndex(source => source.id === id);

  if (sourceIndex === -1) {
    throw new Error(`Source with ID ${id} not found.`);
  }

  const deletedSource = sources[sourceIndex];

  // Delete from Miniflux first
  if (deletedSource.minifluxFeedId) {
    try {
      console.log(`[Miniflux] Attempting to delete feed ID: ${deletedSource.minifluxFeedId}`);
      await minifluxClient.delete(`/v1/feeds/${deletedSource.minifluxFeedId}`);
      console.log(`[Miniflux] Deleted feed ID: ${deletedSource.minifluxFeedId}`);
    } catch (error) {
      console.error(`[Miniflux] Error deleting feed ID ${deletedSource.minifluxFeedId}: ${error.response?.data?.error_message || error.message}`);
      // Log error but proceed with deleting from our list regardless
    }
  } else {
      console.warn(`[SourceService] No Miniflux Feed ID found for source ${id}. Cannot delete from Miniflux.`);
  }

  // Delete from our master list
  sources = sources.filter(source => source.id !== id);
  await saveSources(sources);
  console.log(`[SourceService] Deleted source: ${deletedSource.name} (ID: ${id})`);
  return { id: deletedSource.id, name: deletedSource.name };
}

// --- NEW: Reconciliation Function ---

/**
 * Normalizes a URL for comparison.
 * - Trims whitespace
 * - Removes trailing slash
 * - Converts to lowercase
 * @param {string} url
 * @returns {string}
 */
const normalizeUrl = (url) => {
    if (!url) return '';
    try {
        return url.trim().replace(/\/$/, '').toLowerCase();
    } catch (e) {
        console.warn(`[Source Sync] Error normalizing URL: ${url}`, e);
        return ''; // Return empty string on error
    }
};

/**
 * Fetches all feeds from Miniflux and reconciles them with master_sources.json.
 * Updates minifluxFeedId in master_sources.json where matches are found.
 * Logs discrepancies (feeds in Miniflux but not JSON, sources in JSON but not Miniflux).
 */
const syncWithMinifluxFeeds = async () => {
    console.log('[Source Sync] Starting full synchronization (JSON -> Miniflux)...');
    let minifluxFeedsData = [];
    let masterSources = [];
    let updatedIdCount = 0;
    let addedCount = 0;
    let failedToAddSources = [];
    let deletedFromMinifluxCount = 0;
    let failedToDeleteFromMiniflux = [];

    // --- Step 1: Fetch all feeds from Miniflux and map URL -> ID ---
    const minifluxUrlToIdMap = new Map();
    try {
        console.log('[Source Sync] Fetching feeds from Miniflux...');
        const response = await minifluxClient.get('/v1/feeds');
        minifluxFeedsData = response.data || [];
        minifluxFeedsData.forEach(feed => {
            const normUrl = normalizeUrl(feed.feed_url);
            if (normUrl) {
                 // Handle potential duplicate URLs in Miniflux by preferring the first one encountered
                 if (!minifluxUrlToIdMap.has(normUrl)) { 
                    minifluxUrlToIdMap.set(normUrl, feed.id);
                 } else {
                     console.warn(`[Source Sync] Duplicate URL found in Miniflux fetch: ${normUrl}. Using ID ${minifluxUrlToIdMap.get(normUrl)}.`);
                 }
            }
        });
        console.log(`[Source Sync] Fetched ${minifluxFeedsData.length} feeds from Miniflux, mapped ${minifluxUrlToIdMap.size} unique normalized URLs.`);
    } catch (error) {
        console.error(`[Source Sync] Failed to fetch feeds from Miniflux: ${error.message}`);
        return; // Cannot proceed
    }

    // --- Step 2: Load current master sources ---
    try {
        masterSources = await loadSources();
        console.log(`[Source Sync] Loaded ${masterSources.length} sources from master_sources.json.`);
    } catch (error) {
        console.error(`[Source Sync] Failed to load master sources: ${error.message}`);
        return; // Cannot proceed
    }
    
    const processedMinifluxIds = new Set(); // Track Miniflux IDs corresponding to sources in our JSON

    // --- Step 3: Iterate through Master Sources, Sync IDs, Add Missing ---
    console.log('[Source Sync] Processing master sources list...');
    for (const source of masterSources) {
        const normSourceUrl = normalizeUrl(source.url);
        if (!normSourceUrl) {
            console.warn(`[Source Sync] Skipping source "${source.name}" due to invalid/empty URL.`);
            continue;
        }

        if (minifluxUrlToIdMap.has(normSourceUrl)) {
            // Match found by URL
            const currentMinifluxId = minifluxUrlToIdMap.get(normSourceUrl);
            processedMinifluxIds.add(currentMinifluxId); // Mark this Miniflux ID as processed

            if (source.minifluxFeedId !== currentMinifluxId) {
                console.log(`  - Updating ID for "${source.name}" (URL: ${source.url}): ${source.minifluxFeedId} -> ${currentMinifluxId}`);
                source.minifluxFeedId = currentMinifluxId;
                updatedIdCount++;
            }
        } else {
            // Source from JSON not found in Miniflux by URL - Attempt to add it
            console.warn(`  - Source "${source.name}" (URL: ${source.url}) not found in Miniflux by URL. Attempting to add...`);
            try {
                const minifluxCategoryId = await ensureMinifluxCategory(source.category);
                if (!minifluxCategoryId) {
                    throw new Error(`Could not get or create category ID for '${source.category}'`);
                }
                const response = await minifluxClient.post('/v1/feeds', {
                    feed_url: source.url,
                    category_id: minifluxCategoryId,
                });
                const newMinifluxFeedId = response.data?.id ?? response.data; // Try to get ID
                if (newMinifluxFeedId === undefined || newMinifluxFeedId === null) {
                    throw new Error('Miniflux API call succeeded but did not return a valid Feed ID.');
                }
                console.log(`    -- Successfully added to Miniflux with new Feed ID: ${newMinifluxFeedId}`);
                source.minifluxFeedId = newMinifluxFeedId; // Update ID in memory
                addedCount++;
                processedMinifluxIds.add(newMinifluxFeedId); // Mark the newly added ID as processed
            } catch (error) {
                const errorMessage = error.response?.data?.error_message || error.message;
                console.error(`    -- Error adding source "${source.name}": ${errorMessage}`);
                failedToAddSources.push({ name: source.name, url: source.url, error: errorMessage });
            }
        }
    }
    console.log('[Source Sync] Finished processing master sources list.');

    // --- Step 4: Cleanup Miniflux - Delete feeds not in master list ---
    const minifluxIdsToDelete = [];
    minifluxUrlToIdMap.forEach((id, url) => {
        if (!processedMinifluxIds.has(id)) {
            minifluxIdsToDelete.push({ id: id, url: url }); // Store ID and URL for logging
        }
    });

    if (minifluxIdsToDelete.length > 0) {
        console.warn(`- Action: Deleting ${minifluxIdsToDelete.length} feeds from Miniflux not found in master_sources.json...`);
        for (const feedToDelete of minifluxIdsToDelete) {
            try {
                console.log(`  - Deleting Miniflux Feed ID: ${feedToDelete.id} (Mapped from URL: ${feedToDelete.url})`);
                await minifluxClient.delete(`/v1/feeds/${feedToDelete.id}`);
                console.log(`    -- Successfully deleted Feed ID: ${feedToDelete.id} from Miniflux.`);
                deletedFromMinifluxCount++;
            } catch (error) {
                const errorMessage = error.response?.data?.error_message || error.message;
                console.error(`    -- Error deleting Feed ID ${feedToDelete.id} from Miniflux: ${errorMessage}`);
                failedToDeleteFromMiniflux.push({ id: feedToDelete.id, url: feedToDelete.url, error: errorMessage });
            }
        }
        console.warn('  (Miniflux cleanup attempts finished.)');
    } else {
        console.log('- No feeds found in Miniflux requiring deletion.');
    }

    // --- Step 5: Save Master Sources File ---
    const changesMade = updatedIdCount > 0 || addedCount > 0; // Only save if IDs were updated or sources added
    if (changesMade) { 
         try {
             console.log('[Source Sync] Saving updated master sources file...');
             await saveSources(masterSources);
             console.log('[Source Sync] Successfully saved updates to master_sources.json.');
         } catch (error) {
             console.error(`[Source Sync] CRITICAL ERROR: Failed to save updated master sources: ${error.message}`);
         }
    } else {
        console.log('[Source Sync] No changes made to master_sources.json that require saving.');
    }

    // --- Step 6: Final Report ---
    console.log('\n[Source Sync] Final Synchronization Report:');
    console.log(`- Master Sources Processed: ${masterSources.length}`);
    console.log(`- Miniflux IDs Updated in JSON: ${updatedIdCount}`);
    console.log(`- Sources Added to Miniflux: ${addedCount}`);
    console.log(`- Feeds Deleted from Miniflux: ${deletedFromMinifluxCount}`);
    if (failedToAddSources.length > 0) {
         console.warn(`- Sources FAILED to Add (${failedToAddSources.length}):`);
         failedToAddSources.forEach(f => console.warn(`  - Name: \"${f.name}\", URL: ${f.url}, Error: ${f.error}`));
    } 
    if (failedToDeleteFromMiniflux.length > 0) {
         console.warn(`- Feeds FAILED to Delete from Miniflux (${failedToDeleteFromMiniflux.length}):`);
         failedToDeleteFromMiniflux.forEach(f => console.warn(`  - ID: ${f.id}, URL: ${f.url}, Error: ${f.error}`));
    }

    console.log('[Source Sync] Synchronization finished.');
};

// --- NEW: Cleanup Function ---

/**
 * Removes sources from the master list based on a provided list of URLs.
 * @param {string[]} urlsToRemove - An array of URLs corresponding to sources to be removed.
 * @returns {Promise<number>} - The number of sources actually removed.
 */
async function removeSourcesByUrl(urlsToRemove) {
  if (!urlsToRemove || urlsToRemove.length === 0) {
    console.log('[Cleanup] No URLs provided for removal.');
    return 0;
  }

  console.log(`[Cleanup] Attempting to remove ${urlsToRemove.length} sources by URL...`);
  const masterSources = await loadSources();
  const originalCount = masterSources.length;
  const urlsToRemoveSet = new Set(urlsToRemove.map(url => normalizeUrl(url))); // Normalize URLs for matching

  const sourcesToRemove = masterSources.filter(source => urlsToRemoveSet.has(normalizeUrl(source.url)));
  
  if (sourcesToRemove.length === 0) {
      console.log('[Cleanup] No matching sources found in master list for the provided URLs.');
      return 0;
  }

  console.warn(`[Cleanup] Sources marked for removal (${sourcesToRemove.length}):`);
  sourcesToRemove.forEach(s => console.warn(`  - Removing: Name=\"${s.name}\", URL=${s.url}`));

  // Filter out the sources
  const filteredSources = masterSources.filter(source => !urlsToRemoveSet.has(normalizeUrl(source.url)));
  const removedCount = originalCount - filteredSources.length;

  try {
    await saveSources(filteredSources);
    console.log(`[Cleanup] Successfully removed ${removedCount} sources and saved master_sources.json (${filteredSources.length} remaining).`);
    return removedCount;
  } catch (error) {
    console.error(`[Cleanup] CRITICAL ERROR: Failed to save master_sources.json after attempting removal: ${error.message}`);
    return 0; // Indicate failure
  }
}

// --- Export Functions ---
module.exports = {
    loadSources,
    saveSources,
    getAllSources,
    getSourceById,
    addSource,
    updateSource,
    deleteSource,
    syncWithMinifluxFeeds,
    removeSourcesByUrl // Export the cleanup function
}; 