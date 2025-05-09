const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); // Load .env from backend root

// Import the Source model
const Source = require('../models/Source'); 
const { PoliticalBias, NewsCategory } = require('../types'); // Import enums for validation
const { BIAS_CATEGORIES } = require('../utils/constants'); // <<< Import BIAS_CATEGORIES

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

async function exportAllSources() {
  try {
    console.log("[SourceService - exportAllSources] Fetching sources for export...");
    // Select only specific fields for export by INCLUSION
    const sources = await Source.find({}, {
      _id: 0,         // Exclude _id
      name: 1,        // Include name
      url: 1,         // Include url
      alternateUrl: 1,// Include alternateUrl
      category: 1,    // Include category
      bias: 1         // Include bias
      // Other fields (uuid, minifluxFeedId, createdAt, updatedAt) are excluded by default
    }).lean();
    console.log(`[SourceService - exportAllSources] Exporting ${sources.length} sources.`);
    return sources;
  } catch (error) {
    console.error("[SourceService - exportAllSources] Error fetching sources for export:", error);
    throw new Error('Failed to retrieve sources for export.');
  }
}

// Helper function to process a single imported source
async function _processSingleImportedSource(sourceData) {
  const { url, name, category, bias, alternateUrl } = sourceData;

  // 1. Validate required fields
  if (!url || !name || !category || !bias) {
    return { success: false, message: `Skipped: Missing required fields (url, name, category, bias) for source '${name || url}'.` };
  }

  // 2. Validate category and bias against enums/constants
  if (!Object.values(NewsCategory).includes(category.toUpperCase())) {
    return { success: false, message: `Skipped: Invalid category '${category}' for source '${name}'.` };
  }
  if (!BIAS_CATEGORIES.includes(bias.toUpperCase())) { 
    return { success: false, message: `Skipped: Invalid bias '${bias}' (checking against [${BIAS_CATEGORIES.join(', ')}]) for source '${name}'.` };
  }

  try {
    // 3. Check for duplicate URL in DB
    const existingSourceInDb = await Source.findOne({ url: url });
    if (existingSourceInDb) {
      return { success: false, message: `Skipped: Source with URL ${url} already exists in local DB (Name: ${existingSourceInDb.name}).` };
    }

    const minifluxCategoryId = await ensureMinifluxCategory(category.toUpperCase()); 
    if (!minifluxCategoryId) { // ensureMinifluxCategory now throws, but as a safeguard:
        return { success: false, message: `Failed to ensure Miniflux category '${category.toUpperCase()}' for source '${name}'.` };
    }

    let minifluxFeedId = null;
    let finalMinifluxMessage = ''; // To accumulate Miniflux status messages

    try {
      // Attempt to CREATE feed in Miniflux
      console.log(`[Miniflux] Attempting to create feed for imported source: ${url} in category ID: ${minifluxCategoryId}`);
      const createResponse = await minifluxClient.post('/v1/feeds', {
        feed_url: url,
        category_id: minifluxCategoryId,
      });
      console.log(`[Miniflux] Response from feed creation for ${url}: Status: ${createResponse.status}, Data: ${JSON.stringify(createResponse.data, null, 2)}`);
      minifluxFeedId = createResponse.data?.feed_id;
      
      if (minifluxFeedId === undefined) {
          const warnMsg = `WARNING: minifluxFeedId is undefined after creating feed for ${url}. Expected 'feed_id' in response.data.`;
          console.warn(`[Miniflux] ${warnMsg}`);
          finalMinifluxMessage += `${warnMsg} `;
      } else {
        console.log(`[Miniflux] Successfully created feed for ${url} with Miniflux Feed ID: ${minifluxFeedId}`);
      }
    } catch (createError) {
      const initialErrorMessage = createError.response?.data?.error_message || createError.message;
      
      if (initialErrorMessage && (initialErrorMessage.includes("This feed already exists") || initialErrorMessage.includes("duplicated feed"))) {
        // Log as info because this is an expected path we handle
        console.info(`[Miniflux] Feed ${url} reported as already existing during creation attempt: "${initialErrorMessage}". Proceeding to find and link.`);
        finalMinifluxMessage += `Feed reported as existing by Miniflux. Attempting to find, link, and ensure correct category. Original error: '${initialErrorMessage}'. `;
        console.log(`[Miniflux] Feed ${url} reported as already existing. Attempting to find its ID and ensure correct category.`);
        
        try {
          // Use the enhanced lookup function
          const existingFeedId = await findMinifluxFeedIdByUrl(url);
          
          if (existingFeedId) {
            minifluxFeedId = existingFeedId;
            const foundMsg = `Found existing Miniflux feed for ${url} with ID: ${minifluxFeedId}.`;
            console.log(`[Miniflux] ${foundMsg}`);
            finalMinifluxMessage += `${foundMsg} `;
            
            // Get feed details to check category
            const feedDetails = await minifluxClient.get(`/v1/feeds/${minifluxFeedId}`);
            const currentCategoryId = feedDetails.data?.category?.id;
            
            if (currentCategoryId !== minifluxCategoryId) {
              const catUpdateAttemptMsg = `Attempting to update Miniflux category to ${minifluxCategoryId}.`;
              console.log(`[Miniflux] ${catUpdateAttemptMsg}`);
              finalMinifluxMessage += `${catUpdateAttemptMsg} `;
              try {
                await minifluxClient.put(`/v1/feeds/${minifluxFeedId}`, { category_id: minifluxCategoryId });
                const catUpdateSuccessMsg = `Successfully updated category for existing feed ${url}.`;
                console.log(`[Miniflux] ${catUpdateSuccessMsg}`);
                finalMinifluxMessage += `${catUpdateSuccessMsg} `;
              } catch (updateError) {
                const updateErrorMessage = updateError.response?.data?.error_message || updateError.message;
                const catUpdateFailMsg = `Failed to update category for existing feed ${url} (ID: ${minifluxFeedId}): ${updateErrorMessage}`;
                console.error(`[Miniflux] ${catUpdateFailMsg}`);
                finalMinifluxMessage += `${catUpdateFailMsg} `;
              }
            }
          } else {
            // If still not found, try to create it with a slight URL modification to bypass duplicate detection
            try {
              console.log(`[Miniflux] Feed reported as existing but not found in feeds list. Trying to create with modified URL for ${url}`);
              // Add a query parameter to make the URL unique
              const modifiedUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
              
              const modifiedCreateResponse = await minifluxClient.post('/v1/feeds', {
                feed_url: modifiedUrl,
                category_id: minifluxCategoryId,
              });
              
              minifluxFeedId = modifiedCreateResponse.data?.feed_id;
              if (minifluxFeedId) {
                const modifiedMsg = `Created feed with modified URL: ${modifiedUrl}. Miniflux Feed ID: ${minifluxFeedId}`;
                console.log(`[Miniflux] ${modifiedMsg}`);
                finalMinifluxMessage += `${modifiedMsg} `;
              } else {
                const notFoundWarn = `WARNING: Feed ${url} reported as existing by Miniflux, but NOT FOUND. Modified URL creation also failed to return feed_id. Miniflux ID will remain null.`;
                console.warn(`[Miniflux] ${notFoundWarn}`);
                finalMinifluxMessage += `${notFoundWarn} `;
              }
            } catch (modifiedCreateError) {
              const notFoundWarn = `WARNING: Feed ${url} reported as existing by Miniflux, but NOT FOUND. Modified URL creation also failed: ${modifiedCreateError.message}. Miniflux ID will remain null.`;
              console.warn(`[Miniflux] ${notFoundWarn}`);
              finalMinifluxMessage += `${notFoundWarn} `;
            }
          }
        } catch (findError) {
          const findErrorMsg = `Error occurred while trying to find/sync existing feed ${url} after 'already exists' error: ${findError.message}`;
          console.error(`[Miniflux] ${findErrorMsg}`);
          finalMinifluxMessage += `${findErrorMsg} `;
        }
      } else {
        // Original createError was not "already exists" - this is a hard failure for this source's Miniflux integration.
        // Log the full error response if available
        console.error(`[Miniflux] Error during initial attempt to create feed for ${url}: ${initialErrorMessage}`);
        if (createError.response?.data) {
          console.error(`[Miniflux] Full error response data for ${url} during creation: ${JSON.stringify(createError.response.data, null, 2)}`);
        }
        const criticalMsg = `CRITICAL: Failed to create feed for ${url} due to non-duplicate error: '${initialErrorMessage}'. This source will not be imported.`;
        console.error(`[Miniflux] ${criticalMsg}`);
        return { success: false, message: `Failed to create feed in Miniflux for URL: ${url}. Error: ${initialErrorMessage}` };
      }
    }

    // 6. Create and save the source in MongoDB
    const sourceDoc = new Source({
      uuid: uuidv4(), // Generate new UUID
      url,
      alternateUrl: alternateUrl || null,
      name,
      category: category.toUpperCase(),
      bias: bias.toUpperCase(),
      minifluxFeedId: minifluxFeedId || null, // Ensure it's null if undefined
    });

    await sourceDoc.save();
    const dbSaveMsg = `Imported source to DB: ${name} (${url}), MongoDB _id: ${sourceDoc._id}, MinifluxFeedID: ${sourceDoc.minifluxFeedId}.`;
    console.log(`[SourceService] ${dbSaveMsg}`);
    
    let importMessage = `Successfully imported source: ${name} (${url}). DB ID: ${sourceDoc._id}. Miniflux ID: ${sourceDoc.minifluxFeedId}.`;
    if (finalMinifluxMessage.trim()) {
        importMessage += ` Miniflux notes: ${finalMinifluxMessage.trim()}`;
    }
    return { success: true, message: importMessage, source: sourceDoc.toObject() };

  } catch (error) { // Outer catch for local DB errors or critical ensureMinifluxCategory errors
    console.error(`[SourceService - _processSingleImportedSource] Critical error for source '${name || url}':`, error);
    return { success: false, message: `Critical error processing source '${name || url}': ${error.message}` };
  }
}

async function importSources(sourcesToImport) {
  if (!Array.isArray(sourcesToImport)) {
    throw new Error('Invalid input: Expected an array of sources.');
  }

  const results = {
    added: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  console.log(`[SourceService - importSources] Starting import of ${sourcesToImport.length} sources.`);

  for (const sourceData of sourcesToImport) {
    const result = await _processSingleImportedSource(sourceData);
    results.details.push({ name: sourceData.name || sourceData.url, status: result.success ? 'Imported' : 'Skipped/Error', message: result.message });
    if (result.success) {
      results.added++;
    } else {
      // Check if message indicates a skip due to existing or validation, vs an actual error
      if (result.message.startsWith("Skipped:")) {
          results.skipped++;
      } else {
          results.errors++;
      }
    }
  }

  console.log(`[SourceService - importSources] Import complete. Added: ${results.added}, Skipped: ${results.skipped}, Errors: ${results.errors}`);
  return results;
}

async function purgeAllSources() {
  console.log("[SourceService - purgeAllSources] Starting purge of ALL sources from DB and Miniflux.");
  let dbDeletedCount = 0;
  let minifluxAttemptedDeletions = 0;
  let minifluxSuccessfulDeletions = 0;
  let minifluxFailedDeletions = 0;

  try {
    // Step 1: Get all sources from DB to collect Miniflux feed IDs
    const allSourcesInDb = await Source.find({}, { minifluxFeedId: 1, name: 1 }).lean();
    minifluxAttemptedDeletions = allSourcesInDb.length;

    // Step 2: Attempt to delete each feed from Miniflux
    for (const source of allSourcesInDb) {
      if (source.minifluxFeedId) {
        try {
          console.log(`[Miniflux] Attempting to delete feed ID: ${source.minifluxFeedId} for source: ${source.name}`);
          await minifluxClient.delete(`/v1/feeds/${source.minifluxFeedId}`);
          console.log(`[Miniflux] Successfully deleted feed ID: ${source.minifluxFeedId}`);
          minifluxSuccessfulDeletions++;
        } catch (minifluxError) {
          console.error(`[Miniflux] Failed to delete feed ID ${source.minifluxFeedId} for source ${source.name}: ${minifluxError.response?.data?.error_message || minifluxError.message}`);
          minifluxFailedDeletions++;
          // Continue even if a Miniflux deletion fails
        }
      }
    }

    // Step 3: Delete all sources from MongoDB
    const deletionResult = await Source.deleteMany({});
    dbDeletedCount = deletionResult.deletedCount;
    console.log(`[SourceService - purgeAllSources] Deleted ${dbDeletedCount} sources from MongoDB.`);

    return {
      success: true,
      message: `Purge complete. DB: ${dbDeletedCount} deleted. Miniflux: ${minifluxSuccessfulDeletions} deleted, ${minifluxFailedDeletions} failed out of ${minifluxAttemptedDeletions} attempted.`,
      dbDeletedCount,
      minifluxAttemptedDeletions,
      minifluxSuccessfulDeletions,
      minifluxFailedDeletions
    };

  } catch (error) {
    console.error("[SourceService - purgeAllSources] Critical error during purge operation:", error);
    return {
      success: false,
      message: `Critical error during purge: ${error.message}`,
      dbDeletedCount,
      minifluxAttemptedDeletions,
      minifluxSuccessfulDeletions,
      minifluxFailedDeletions
    };
  }
}

// Add this function after the getMinifluxFeeds function
// Helper function to find a feed in Miniflux by URL with fuzzy matching
async function findMinifluxFeedIdByUrl(url) {
  try {
    console.log(`[Miniflux] Attempting to find feed for URL: ${url}`);
    
    // Get all feeds from Miniflux
    const allFeeds = await getMinifluxFeeds();
    
    // Try exact match first
    let matchingFeed = allFeeds.find(feed => feed.url === url);
    if (matchingFeed) {
      console.log(`[Miniflux] Found exact match for ${url} with ID: ${matchingFeed.id}`);
      return matchingFeed.id;
    }
    
    // Try with/without trailing slash
    const urlWithSlash = url.endsWith('/') ? url : `${url}/`;
    const urlWithoutSlash = url.endsWith('/') ? url.slice(0, -1) : url;
    
    matchingFeed = allFeeds.find(feed => 
      feed.url === urlWithSlash || feed.url === urlWithoutSlash
    );
    if (matchingFeed) {
      console.log(`[Miniflux] Found match with slash variation for ${url} with ID: ${matchingFeed.id}`);
      return matchingFeed.id;
    }
    
    // Try fuzzy matching (partial URL contains)
    const urlDomain = new URL(url).hostname;
    const urlPath = new URL(url).pathname;
    
    // Look for feeds with matching domain and similar path
    const potentialMatches = allFeeds.filter(feed => {
      try {
        const feedDomain = new URL(feed.url).hostname;
        // Check if domains match
        return feedDomain === urlDomain;
      } catch (err) {
        return false;
      }
    });
    
    if (potentialMatches.length > 0) {
      // Sort potential matches by similarity (shorter URL difference is better)
      potentialMatches.sort((a, b) => {
        try {
          const aPathDiff = Math.abs(new URL(a.url).pathname.length - urlPath.length);
          const bPathDiff = Math.abs(new URL(b.url).pathname.length - urlPath.length);
          return aPathDiff - bPathDiff;
        } catch (err) {
          return 0;
        }
      });
      
      // Take the best match
      console.log(`[Miniflux] Found fuzzy match for ${url} with ID: ${potentialMatches[0].id}`);
      return potentialMatches[0].id;
    }
    
    console.log(`[Miniflux] No matching feed found for ${url}`);
    return null;
  } catch (error) {
    console.error(`[Miniflux] Error finding feed by URL ${url}: ${error.message}`);
    return null;
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
    getUniqueSourceCategories,
    exportAllSources,
    importSources,         
    purgeAllSources      // Export the new purge function
}; 