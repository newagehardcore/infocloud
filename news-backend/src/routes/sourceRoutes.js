const express = require('express');
const router = express.Router();
const { 
    getAllSources, 
    addSource, 
    updateSource, 
    deleteSource,
    fixUnknownCategoryItems,
} = require('../services/sourceManagementService'); 
const { BIAS_CATEGORIES } = require('../utils/constants'); // Import defined bias categories
const fs = require('fs').promises; // Use promises version of fs
const path = require('path');

// Correct path to master_sources.json relative to this file
const SOURCES_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'master_sources.json');

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
        // Read the master sources file to extract unique categories
        let categories = ['Uncategorized']; // Default category
        try {
            const data = await fs.readFile(SOURCES_FILE_PATH, 'utf8');
            const sources = JSON.parse(data);
            // Get unique, non-empty categories and sort them
            const uniqueCategories = [...new Set(sources.map(s => s.category).filter(Boolean))].sort();
            if (uniqueCategories.length > 0) {
                categories = uniqueCategories;
            }
             // Ensure 'Uncategorized' is present if needed, or just use it as default if no others exist
            if (!categories.includes('Uncategorized')) {
                 categories.push('Uncategorized'); // Add if not present
                 categories.sort(); // Re-sort after adding
            }

        } catch (readError) {
            // If file doesn't exist or can't be read, proceed with default category
            console.warn(`[Config] Could not read ${SOURCES_FILE_PATH} to get categories, using default. Error: ${readError.message}`);
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


// POST /api/sources - Add a new source
router.post('/', async (req, res) => {
    try {
        const { url, name, category, bias } = req.body;
        if (!url || !name || !category || !bias) {
            return res.status(400).json({ message: "Missing required fields: url, name, category, bias" });
        }
        if (!BIAS_CATEGORIES.includes(bias)) {
             return res.status(400).json({ message: `Invalid bias category. Must be one of: ${BIAS_CATEGORIES.join(', ')}` });
        }
        const newSource = await addSource({ url, name, category, bias });
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

// PUT /api/sources/:id - Update an existing source
router.put('/:id', async (req, res) => {
    console.log(`[sourceRoutes] PUT /api/sources/${req.params.id} received.`);
    console.log(`[sourceRoutes] Request Body:`, req.body);
    try {
        const { id } = req.params;
        // Expecting body like { name: '...', category: '...', bias: '...' }
        // Or from inline edit: { category: '...' } or { bias: '...' }
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

        // Validate bias if provided
        if (updates.bias && !BIAS_CATEGORIES.includes(updates.bias)) {
            return res.status(400).json({ message: `Invalid bias category. Must be one of: ${BIAS_CATEGORIES.join(', ')}` });
        }
        
        // Validate category if provided (Check against config? Or just allow any string?)
        // For now, allow any string, sourceManagementService can handle validation if needed.
        // if (updates.category && !allowedCategories.includes(updates.category)) { ... }
        // --- End Validation ---
        
        const updatedSource = await updateSource(id, updates);
        if (!updatedSource) {
            return res.status(404).json({ message: "Source not found" });
        }
        res.json(updatedSource); // Return the full updated source
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

// NEW: Route to fix items with UNKNOWN category
router.post('/fix-unknown-categories', async (req, res) => {
    console.log("Received request to fix items with UNKNOWN category...");
    try {
        const updateResult = await fixUnknownCategoryItems();
        res.json({ message: `Category fix process completed. Updated ${updateResult.modifiedCount} items.`, details: updateResult });
    } catch (error) {
        console.error('Error running fix unknown categories:', error);
        res.status(500).json({ message: "Failed to run category fix process", error: error.message });
    }
});

module.exports = router; 