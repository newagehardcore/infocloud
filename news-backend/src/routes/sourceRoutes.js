const express = require('express');
const router = express.Router();
const { 
    getAllSources, 
    addSource, 
    updateSource, 
    deleteSource,
    getUniqueSourceCategories
} = require('../services/sourceManagementService'); 
const { BIAS_CATEGORIES } = require('../utils/constants'); // Import defined bias categories

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

module.exports = router; 