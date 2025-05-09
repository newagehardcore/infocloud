const express = require('express');
const router = express.Router();
const multer = require('multer'); // Import multer
const { 
    getAllSources, 
    addSource, 
    updateSource, 
    deleteSource,
    getUniqueSourceCategories,
    getMinifluxFeeds,
    exportAllSources,
    importSources,
    purgeAllSources
} = require('../services/sourceManagementService'); 
const { BIAS_CATEGORIES } = require('../utils/constants'); // Import defined bias categories
const { aggregateKeywordsForCloud } = require('../services/wordProcessingService'); // Added for cache rebuild
const mongoose = require('mongoose'); // Need mongoose for connection.db

// Configure multer for memory storage (to read file content as buffer/string)
// And a filter to only accept JSON files.
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/json') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JSON is allowed.'), false);
  }
};
const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // Limit file size to 5MB

// GET /api/sources - List all sources
router.get('/', async (req, res) => {
    try {
        const sources = await getAllSources();
        // Add cache-control headers
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        res.json(sources); // Send response *after* setting headers
    } catch (error) {
        console.error("Error fetching sources:", error);
        res.status(500).json({ message: "Failed to fetch sources", error: error.message });
    }
});

// GET /api/sources/config - Get available bias/categories (for UI dropdowns)
router.get('/config', async (req, res) => {
    try {
        let categories = ['Uncategorized']; // Default in case DB fetch fails or returns empty
        try {
            const dbCategories = await getUniqueSourceCategories();
            if (dbCategories && dbCategories.length > 0) {
                categories = dbCategories;
            }
            // Ensure 'Uncategorized' is present if not already included by DB query (shouldn't happen if data is clean)
            if (!categories.includes('Uncategorized')) {
                 categories.push('Uncategorized');
                 categories.sort(); // Re-sort if 'Uncategorized' was added
            }
        } catch (dbError) {
            console.warn(`[Config] Could not fetch categories from DB, using default. Error: ${dbError.message}`);
        }

        // Add cache-control headers
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        
        res.json({
            biasCategories: BIAS_CATEGORIES,
            sourceCategories: categories // Add categories to response
        });
    } catch (error) {
        console.error("Error fetching config:", error);
        res.status(500).json({ message: "Failed to fetch configuration", error: error.message });
    }
});

// GET /api/sources/export - Export all sources as JSON
router.get('/export', async (req, res) => {
    try {
        const sources = await exportAllSources();
        res.setHeader('Content-Disposition', 'attachment; filename="sources_export.json"');
        res.setHeader('Content-Type', 'application/json');
        // Add cache-control headers to prevent caching of this dynamic file
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        res.status(200).json(sources);
    } catch (error) {
        console.error("Error exporting sources:", error);
        res.status(500).json({ message: "Failed to export sources", error: error.message });
    }
});

// POST /api/sources - Add a new source
router.post('/', async (req, res) => {
    try {
        const { url, name, category, bias } = req.body;

        // --- Updated Validation ---
        // Ensure all required fields are present and non-empty
        if (!url || !name || !bias) { // Removed category from this initial check
            return res.status(400).json({ message: "Missing required fields: url, name, bias" });
        }
        // Specific validation for category: Must exist, not be empty, and not be 'Uncategorized'
        if (!category || category.trim().length === 0) {
            return res.status(400).json({ message: "Category field is required and cannot be empty." });
        }
        if (category.trim().toLowerCase() === 'uncategorized') {
            return res.status(400).json({ message: "Please select a specific category instead of 'Uncategorized'." });
        }
        // Validate bias
        if (!BIAS_CATEGORIES.includes(bias)) {
             return res.status(400).json({ message: `Invalid bias category. Must be one of: ${BIAS_CATEGORIES.join(', ')}` });
        }
        // --- End Updated Validation ---

        const newSource = await addSource({ url, name, category: category.trim(), bias }); // Trim category before saving
        res.status(201).json(newSource);
    } catch (error) {
        console.error("Error adding source:", error);
        // Check for Miniflux specific errors if possible (e.g., duplicate URL)
        if (error.message.includes("Feed already exists")) { // Example check
             res.status(409).json({ message: "Feed already exists in Miniflux", error: error.message });
        } else {
             res.status(500).json({ message: "Failed to add source", error: error.message });
        }
    }
});

// POST /api/sources/import - Import sources from JSON file
router.post('/import', upload.single('sourcesFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
    }

    try {
        const fileContent = req.file.buffer.toString('utf8');
        const sourcesToImport = JSON.parse(fileContent);
        
        const importResults = await importSources(sourcesToImport);
        
        res.status(200).json({
            message: "Import process completed.",
            added: importResults.added,
            skipped: importResults.skipped,
            errors: importResults.errors,
            details: importResults.details
        });

    } catch (error) {
        console.error("Error importing sources:", error);
        if (error instanceof SyntaxError) {
            res.status(400).json({ message: "Invalid JSON file format.", error: error.message });
        } else if (error.message.includes("Invalid file type")) {
            res.status(400).json({ message: error.message });
        } else {
            res.status(500).json({ message: "Failed to import sources", error: error.message });
        }
    }
});

// POST /api/sources/purge-all - Purge all sources from DB and Miniflux
router.post('/purge-all', async (req, res) => {
    console.log("[API] Received request to purge all sources.");
    try {
        const result = await purgeAllSources();
        if (result.success) {
            res.status(200).json({ message: result.message, details: result });
        } else {
            // Even if not fully successful (e.g. some Miniflux deletes failed), 
            // if the main operation didn't throw a critical error, it might still be a 200 with details.
            // However, if success is false due to a critical error in the service, send 500.
            res.status(500).json({ message: result.message || "Failed to purge all sources due to an internal error.", details: result });
        }
    } catch (error) {
        console.error("[API] Critical error during /purge-all operation:", error);
        res.status(500).json({ message: "Critical error during purge operation on the server.", error: error.message });
    }
});

// PUT /api/sources/:id - Update an existing source
router.put('/:id', async (req, res) => {
    console.log(`[sourceRoutes] PUT /api/sources/${req.params.id} received.`);
    console.log(`[sourceRoutes] Request Body:`, req.body);
    try {
        const { id } = req.params;
        const updates = req.body;

        // --- Validation --- 
        const allowedFields = ['name', 'category', 'bias'];
        const receivedFields = Object.keys(updates);
        const invalidFields = receivedFields.filter(field => !allowedFields.includes(field));
        
        if (invalidFields.length > 0) {
             return res.status(400).json({ message: `Invalid fields provided: ${invalidFields.join(', ')}. Only name, category, bias can be updated.` });
        }
        
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No update fields provided (name, category, or bias)." });
        }

        if (updates.bias && !BIAS_CATEGORIES.includes(updates.bias)) {
            return res.status(400).json({ message: `Invalid bias category. Must be one of: ${BIAS_CATEGORIES.join(', ')}` });
        }
        // --- End Validation ---
        
        const updatedSource = await updateSource(id, updates);
        if (!updatedSource) {
            return res.status(404).json({ message: "Source not found" });
        }

        let changesPropagated = false;

        // If bias was updated, propagate this change to related NewsItems
        if (updatedSource && updates.bias && updatedSource.minifluxFeedId) {
            const newBias = updates.bias;
            const feedId = updatedSource.minifluxFeedId;
            console.log(`[sourceRoutes] Source ${updatedSource.name} (feedId: ${feedId}) bias updated to ${newBias}. Propagating to NewsItems.`);
            try {
                const newsItemUpdateResult = await mongoose.connection.db.collection('newsitems').updateMany(
                    { 'source.minifluxFeedId': feedId },
                    { 
                        $set: { 
                            'source.bias': newBias,
                            'bias': newBias
                        } 
                    }
                );
                console.log(`[sourceRoutes] NewsItem bias update: Matched: ${newsItemUpdateResult.matchedCount}, Modified: ${newsItemUpdateResult.modifiedCount} for feedId ${feedId}.`);
                changesPropagated = true;
            } catch (newsItemUpdateError) {
                console.error(`[sourceRoutes] Error updating NewsItem bias for feedId ${feedId} (source ${updatedSource.name}):`, newsItemUpdateError);
            }
        }

        // If category was updated, propagate this change to related NewsItems
        if (updatedSource && updates.category && updatedSource.minifluxFeedId) {
            const newCategory = updates.category;
            const feedId = updatedSource.minifluxFeedId;
            console.log(`[sourceRoutes] Source ${updatedSource.name} (feedId: ${feedId}) category updated to ${newCategory}. Propagating to NewsItems.`);
            try {
                const newsItemUpdateResult = await mongoose.connection.db.collection('newsitems').updateMany(
                    { 'source.minifluxFeedId': feedId },
                    { 
                        $set: { 'source.category': newCategory } 
                    }
                );
                console.log(`[sourceRoutes] NewsItem category update: Matched: ${newsItemUpdateResult.matchedCount}, Modified: ${newsItemUpdateResult.modifiedCount} for feedId ${feedId}.`);
                changesPropagated = true;
            } catch (newsItemUpdateError) {
                console.error(`[sourceRoutes] Error updating NewsItem category for feedId ${feedId} (source ${updatedSource.name}):`, newsItemUpdateError);
            }
        }

        // If any relevant changes were propagated, rebuild keyword cache
        if (changesPropagated) {
            aggregateKeywordsForCloud().then(() => {
                console.log(`[sourceRoutes] Keyword cache rebuild triggered successfully after source ${updatedSource.name} update.`);
            }).catch(cacheError => {
                console.error(`[sourceRoutes] Error triggering keyword cache rebuild for source ${updatedSource.name}:`, cacheError);
            });
        }
        
        res.json(updatedSource);
    } catch (error) {
        console.error(`Error updating source ${req.params.id}:`, error);
        res.status(500).json({ message: "Failed to update source", error: error.message });
    }
});

// DELETE /api/sources/:id - Delete a source
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const success = await deleteSource(id);
        if (!success) {
            // This might happen if the source exists in JSON but fails deletion in Miniflux,
            // or if the source wasn't found in the JSON to begin with.
            // sourceManagementService should ideally differentiate. For now, assume not found.
             return res.status(404).json({ message: "Source not found or deletion failed" });
        }
        res.status(204).send(); // No content on successful deletion
    } catch (error) {
        console.error(`Error deleting source ${req.params.id}:`, error);
        res.status(500).json({ message: "Failed to delete source", error: error.message });
    }
});

module.exports = router; 