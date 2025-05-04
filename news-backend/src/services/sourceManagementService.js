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
    console.log('[Source Sync] Starting reconciliation with Miniflux feeds...');
    let minifluxFeeds = [];
    let masterSources = [];
    let updatedCount = 0;
    let missingFromMaster = [];
    let orphansInMaster = [];

    // 1. Fetch all feeds from Miniflux
    try {
        console.log('[Source Sync] Fetching feeds from Miniflux...');
        const response = await minifluxClient.get('/v1/feeds');
        minifluxFeeds = response.data || [];
        console.log(`[Source Sync] Fetched ${minifluxFeeds.length} feeds from Miniflux.`);
    } catch (error) {
        console.error(`[Source Sync] Failed to fetch feeds from Miniflux: ${error.message}`);
        return; // Cannot proceed
    }

    // 2. Load current master sources
    try {
        masterSources = await loadSources();
        console.log(`[Source Sync] Loaded ${masterSources.length} sources from master_sources.json.`);
    } catch (error) {
        console.error(`[Source Sync] Failed to load master sources: ${error.message}`);
        return; // Cannot proceed
    }

    // 3. Create lookup maps for master sources
    const masterSourceMapByUrl = new Map();
    const masterSourceMapById = new Map();
    const foundInMiniflux = new Set(); // To track which master sources correspond to a Miniflux feed

    masterSources.forEach(source => {
        const normUrl = normalizeUrl(source.url);
        if (normUrl) {
             masterSourceMapByUrl.set(normUrl, source);
        }
         // Also map by existing Miniflux ID if present (for orphan check)
         if (source.minifluxFeedId) {
            masterSourceMapById.set(source.minifluxFeedId, source);
         }
    });

    // 4. Reconcile: Iterate through Miniflux feeds
    console.log('[Source Sync] Reconciling Miniflux feeds with master sources...');
    for (const feed of minifluxFeeds) {
        const normFeedUrl = normalizeUrl(feed.feed_url);
        let matchedSource = null;

        // Try matching by URL first
        if (normFeedUrl && masterSourceMapByUrl.has(normFeedUrl)) {
            matchedSource = masterSourceMapByUrl.get(normFeedUrl);
        } 
        // Optional: Could add fallback matching by feed.id if URL fails?
        // else if (masterSourceMapById.has(feed.id)) { ... }

        if (matchedSource) {
            foundInMiniflux.add(matchedSource.id); // Mark master source as found

            // Check if Miniflux ID needs update
            if (matchedSource.minifluxFeedId !== feed.id) {
                console.log(`[Source Sync] Updating Miniflux ID for source "${matchedSource.name}" (URL: ${matchedSource.url}) from ${matchedSource.minifluxFeedId} to ${feed.id}`);
                matchedSource.minifluxFeedId = feed.id;
                updatedCount++;
            }

            // Optional: Check for category/name differences (just log for now)
            if (matchedSource.category !== feed.category?.title) {
                 // console.log(`[Source Sync] Category mismatch for "${matchedSource.name}": Master="${matchedSource.category}", Miniflux="${feed.category?.title}"`);
            }
            if (matchedSource.name !== feed.title) {
                 // console.log(`[Source Sync] Name mismatch for Feed ID ${feed.id}: Master="${matchedSource.name}", Miniflux="${feed.title}"`);
            }

        } else {
            // Feed exists in Miniflux but not in our master list (based on URL)
            missingFromMaster.push({ 
                minifluxId: feed.id, 
                title: feed.title, 
                url: feed.feed_url, 
                category: feed.category?.title 
            });
        }
    }

    // 5. Identify orphans in master list
    masterSources.forEach(source => {
        if (!foundInMiniflux.has(source.id)) {
            // Source exists in JSON but wasn't found via URL match with any Miniflux feed
             orphansInMaster.push({
                 id: source.id,
                 name: source.name,
                 url: source.url,
                 minifluxFeedId: source.minifluxFeedId
             });
        }
    });

    // 6. Log results
    console.log('[Source Sync] Reconciliation Summary:');
    console.log(`- Miniflux Feeds Found: ${minifluxFeeds.length}`);
    console.log(`- Master Sources Loaded: ${masterSources.length}`);
    console.log(`- Master Sources Updated (Miniflux ID): ${updatedCount}`);
    
    if (missingFromMaster.length > 0) {
        console.warn(`- Feeds Missing from Master List (${missingFromMaster.length}):`);
        missingFromMaster.forEach(f => console.warn(`  - ID: ${f.minifluxId}, Title: "${f.title}", URL: ${f.url}, Category: ${f.category}`));
        console.warn('  (These feeds exist in Miniflux but could not be matched by URL to any source in master_sources.json)');
    } else {
        console.log('- No feeds found in Miniflux that are missing from the master list.');
    }

    if (orphansInMaster.length > 0) {
        console.warn(`- Orphan Sources in Master List (${orphansInMaster.length}):`);
        orphansInMaster.forEach(s => console.warn(`  - ID: ${s.id}, Name: "${s.name}", URL: ${s.url}, Stored Miniflux ID: ${s.minifluxFeedId}`));
        console.warn('  (These sources exist in master_sources.json but were not found by URL match in Miniflux)');
    } else {
        console.log('- No orphan sources identified in the master list.');
    }

    // 7. Save updated master sources if changes were made
    if (updatedCount > 0) {
        try {
            console.log('[Source Sync] Saving updated master sources file...');
            await saveSources(masterSources);
            console.log('[Source Sync] Successfully saved updates to master_sources.json.');
        } catch (error) {
            console.error(`[Source Sync] Failed to save updated master sources: ${error.message}`);
        }
    } else {
        console.log('[Source Sync] No Miniflux IDs needed updating in master_sources.json.');
    }

    console.log('[Source Sync] Reconciliation finished.');
};

// --- Export Functions ---
module.exports = {
    loadSources,
    saveSources,
    getAllSources,
    getSourceById,
    addSource,
    updateSource,
    deleteSource,
    syncWithMinifluxFeeds // Export the new function
}; 