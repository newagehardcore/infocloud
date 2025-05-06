const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); // Load .env from backend root

// Import the Source model
const Source = require('../models/Source'); 

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

// --- CRUD Operations ---

async function getAllSources() {
  try {
    console.log("[SourceService - getAllSources] Fetching sources from DB...");
    const sources = await Source.find().sort({ name: 1 }).lean(); // Fetch sorted by name, use lean
    console.log(`[SourceService - getAllSources] Found ${sources.length} sources.`);
    // Map _id to id for frontend compatibility if needed, or change frontend later
    return sources.map(s => ({ ...s, id: s.uuid })); 
  } catch (error) {
    console.error("[SourceService - getAllSources] Error fetching sources from DB:", error);
    throw new Error('Failed to retrieve sources from database.');
  }
}

// Note: Frontend uses UUID as 'id'. Keep this function using uuid for now.
async function getSourceById(uuid) {
  try {
    console.log(`[SourceService - getSourceById] Finding source with uuid: ${uuid}`);
    const source = await Source.findOne({ uuid: uuid }).lean();
    if (source) {
        console.log(`[SourceService - getSourceById] Found source: ${source.name}`);
        return { ...source, id: source.uuid }; // Map _id to id
    } else {
        console.log(`[SourceService - getSourceById] Source not found.`);
        return null;
    }
  } catch (error) {
      console.error(`[SourceService - getSourceById] Error finding source uuid ${uuid}:`, error);
      throw new Error('Database error finding source by UUID.');
  }
}

async function addSource(newSourceData) {
  const { url, name, category, bias, alternateUrl } = newSourceData;

  if (!url || !name || !category || !bias) {
    throw new Error('Missing required fields for new source (url, name, category, bias).');
  }

  try {
    // Check for duplicate URL in DB
    const existingSource = await Source.findOne({ url: url });
    if (existingSource) {
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
      });
      minifluxFeedId = response.data.id;
      console.log(`[Miniflux] Created feed for ${url} with ID: ${minifluxFeedId}`);
    } catch (error) {
      console.error(`[Miniflux] Error creating feed ${url}: ${error.response?.data?.error_message || error.message}`);
      throw new Error(`Failed to create feed in Miniflux for URL: ${url}`);
    }

    // 3. Create and save the source in MongoDB
    const sourceDoc = new Source({
      uuid: uuidv4(), // Generate UUID
      url,
      alternateUrl: alternateUrl || null,
      name,
      category: category.toUpperCase(), // Ensure uppercase
      bias: bias.toUpperCase(), // Ensure uppercase
      minifluxFeedId, 
    });

    await sourceDoc.save();
    console.log(`[SourceService] Added source to DB: ${name} (${url}), MongoDB _id: ${sourceDoc._id}`);
    
    // Return a plain object matching frontend expectations (with uuid as id)
    const savedSource = sourceDoc.toObject();
    return { ...savedSource, id: savedSource.uuid }; 

  } catch (error) {
    // Catch potential validation errors from Mongoose as well
    console.error("[SourceService - addSource] Error:", error);
    if (error.code === 11000) { // Duplicate key error (likely URL)
        throw new Error(`Source with URL ${url} already exists (DB constraint).`);
    } else if (error.name === 'ValidationError') {
        throw new Error(`Validation failed: ${error.message}`);
    } else {
        // Rethrow other errors (like Miniflux errors caught earlier)
        throw error;
    }
  }
}

// Note: Frontend passes UUID as 'id' parameter
async function updateSource(uuid, updatedData) {
  console.log(`[SourceService - updateSource] Starting DB update for UUID: ${uuid} with data:`, updatedData);
  
  try {
    // Find the original source first to check category for Miniflux sync
    const originalSource = await Source.findOne({ uuid: uuid });

    if (!originalSource) {
      throw new Error(`Source with UUID ${uuid} not found.`);
    }

    let categoryChanged = false;
    let newMinifluxCategoryId = null;

    // Validate and prepare updates, convert to uppercase where needed
    const validatedUpdates = {};
    if (updatedData.name !== undefined) validatedUpdates.name = updatedData.name;
    if (updatedData.bias !== undefined) validatedUpdates.bias = updatedData.bias.toUpperCase();
    if (updatedData.category !== undefined) validatedUpdates.category = updatedData.category.toUpperCase();
    
    // Check if category changed and ensure the new category exists in Miniflux
    if (validatedUpdates.category && validatedUpdates.category !== originalSource.category) {
      try {
          newMinifluxCategoryId = await ensureMinifluxCategory(validatedUpdates.category);
          categoryChanged = true;
          console.log(`[SourceService] Category change detected for ${uuid}: ${originalSource.category} -> ${validatedUpdates.category}. New Miniflux Category ID: ${newMinifluxCategoryId}`);
      } catch (categoryError) {
           console.error(`[SourceService] Error ensuring Miniflux category for update: ${categoryError.message}`);
           throw new Error(`Failed to update source: Could not ensure Miniflux category '${validatedUpdates.category}'.`);
      }
    }

    // Atomically update the document in MongoDB
    // We add updatedAt manually here because findOneAndUpdate needs it explicitly set
    validatedUpdates.updatedAt = new Date(); 
    const updatedSourceDoc = await Source.findOneAndUpdate(
        { uuid: uuid }, 
        { $set: validatedUpdates }, 
        { new: true, runValidators: true } // Return updated doc, run validators
    ).lean(); // Use lean for plain object

    if (!updatedSourceDoc) {
        // Should not happen if originalSource was found, but good practice
        throw new Error(`Source with UUID ${uuid} not found during update operation.`);
    }
    
    console.log(`[SourceService - updateSource] Updated source in DB for UUID: ${uuid}`);

    // Update Miniflux feed category if it changed AND the source has a Miniflux ID
    if (categoryChanged && originalSource.minifluxFeedId && newMinifluxCategoryId) {
      try {
        console.log(`[Miniflux] Attempting to update category for feed ID ${originalSource.minifluxFeedId} to category ID ${newMinifluxCategoryId}`);
        await minifluxClient.put(`/v1/feeds/${originalSource.minifluxFeedId}`, {
          category_id: newMinifluxCategoryId
        });
        console.log(`[Miniflux] Updated category for feed ID ${originalSource.minifluxFeedId}`);
      } catch (error) {
        console.error(`[Miniflux] Error updating category for feed ID ${originalSource.minifluxFeedId}: ${error.response?.data?.error_message || error.message}`);
        // Log the error, but don't block the response
      }
    } else if (categoryChanged && !originalSource.minifluxFeedId) {
        console.warn(`[SourceService] Category changed for source ${uuid}, but no Miniflux Feed ID found. Cannot sync category change to Miniflux.`);
    }
    
    // Return the updated source, mapping _id to id for frontend
    return { ...updatedSourceDoc, id: updatedSourceDoc.uuid };

  } catch (error) {
      console.error(`[SourceService - updateSource] Error updating source uuid ${uuid}:`, error);
      if (error.name === 'ValidationError') {
          throw new Error(`Validation failed: ${error.message}`);
      } else {
          throw error; // Rethrow other errors
      }
  }
}

// Note: Frontend passes UUID as 'id' parameter
async function deleteSource(uuid) {
  console.log(`[SourceService - deleteSource] Attempting delete for UUID: ${uuid}`);
  try {
    // Find the source first to get Miniflux ID
    const sourceToDelete = await Source.findOne({ uuid: uuid });

    if (!sourceToDelete) {
      // If not found, maybe it was already deleted? Return success-like state.
      console.warn(`[SourceService - deleteSource] Source with UUID ${uuid} not found. Assuming already deleted.`);
      return { deletedCount: 0 }; // Indicate nothing was deleted now
    }

    const minifluxFeedId = sourceToDelete.minifluxFeedId;
    const sourceName = sourceToDelete.name;

    // Delete from Miniflux first
    if (minifluxFeedId) {
      try {
        console.log(`[Miniflux] Attempting to delete feed ID: ${minifluxFeedId}`);
        await minifluxClient.delete(`/v1/feeds/${minifluxFeedId}`);
        console.log(`[Miniflux] Deleted feed ID: ${minifluxFeedId}`);
      } catch (error) {
        console.error(`[Miniflux] Error deleting feed ID ${minifluxFeedId}: ${error.response?.data?.error_message || error.message}`);
        // Log error but proceed with deleting from our DB regardless
      }
    } else {
        console.warn(`[SourceService] No Miniflux Feed ID found for source ${uuid}. Cannot delete from Miniflux.`);
    }

    // Delete from MongoDB
    const deletionResult = await Source.deleteOne({ uuid: uuid });
    
    if (deletionResult.deletedCount > 0) {
        console.log(`[SourceService] Deleted source from DB: ${sourceName} (UUID: ${uuid})`);
    } else {
        console.warn(`[SourceService] Source with UUID ${uuid} was found but delete operation removed 0 documents.`);
    }
    
    // Return standard information
    return { 
        id: uuid, // Return the UUID that was requested for deletion
        name: sourceName, 
        deletedCount: deletionResult.deletedCount 
    };

  } catch (error) {
      console.error(`[SourceService - deleteSource] Error deleting source uuid ${uuid}:`, error);
      throw new Error('Database error during source deletion.');
  }
}

// --- Sync/Cleanup Functions (Needs MongoDB Rewrite) ---

// TODO: Rewrite syncWithMinifluxFeeds to use MongoDB Source model
const syncWithMinifluxFeeds = async () => {
    console.warn("[SourceService] syncWithMinifluxFeeds function needs to be rewritten to use MongoDB. Skipping sync.");
    // Placeholder implementation
    return;
    /* 
    console.log('[Source Sync] Starting full synchronization (DB -> Miniflux)... CURRENTLY DISABLED');
    let minifluxFeedsData = [];
    let dbSources = [];
    // ... (rest of the logic needs complete rewrite) ...
    */
};

// TODO: Rewrite removeSourcesByUrl to use MongoDB Source model
async function removeSourcesByUrl(urlsToRemove) {
    console.warn("[SourceService] removeSourcesByUrl function needs to be rewritten to use MongoDB. Skipping removal.");
    return 0;
    /*
    if (!urlsToRemove || urlsToRemove.length === 0) {
        console.log('[Cleanup] No URLs provided for removal.');
        return 0;
    }
    // ... (rest of the logic needs complete rewrite using Source.deleteMany) ...
    */
}

// Helper function to get all feeds from Miniflux (Keep as is)
async function getMinifluxFeeds() {
  try {
    const response = await minifluxClient.get('/v1/feeds');
    // Return only essential info: id and url
    return response.data.map(feed => ({ id: feed.id, url: feed.feed_url }));
  } catch (error) {
    console.error(`[Miniflux] Error fetching all feeds: ${error.response?.data?.error_message || error.message}`);
    throw new Error('Failed to fetch feeds from Miniflux.');
  }
}

// NEW function to get unique source categories from DB
async function getUniqueSourceCategories() {
  try {
    console.log("[SourceService - getUniqueSourceCategories] Fetching distinct categories from DB...");
    const categories = await Source.distinct('category');
    // Filter out null or empty string categories, then sort
    const sortedCategories = categories.filter(cat => cat && cat.trim() !== '').sort();
    console.log(`[SourceService - getUniqueSourceCategories] Found ${sortedCategories.length} distinct categories.`);
    return sortedCategories;
  } catch (error) {
    console.error("[SourceService - getUniqueSourceCategories] Error fetching distinct categories:", error);
    throw new Error('Failed to retrieve distinct categories from database.');
  }
}

// --- Export Functions ---
module.exports = {
    // Removed loadSources, saveSources
    getAllSources,
    getSourceById,
    addSource,
    updateSource,
    deleteSource,
    getMinifluxFeeds,
    syncWithMinifluxFeeds, // Keep export, but function is disabled
    removeSourcesByUrl,    // Keep export, but function is disabled
    getUniqueSourceCategories // <<< Export new function
}; 