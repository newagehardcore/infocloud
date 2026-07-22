const express = require('express');
const axios = require('axios');
const { getLlmFallbackCount, clearKeywordCache } = require('../services/wordProcessingService');
const { getCurrentModelName, setActiveModel } = require('../services/llmService');
const { forceRefreshAllFeeds } = require('../services/rssService');
const { suspendTicks, resumeTicks } = require('../tick');
const newsItemRepo = require('../db/newsItemRepo');
const { getPool } = require('../db/mysql');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Use fs.promises

// --- Service health checks for the admin status panel ---

async function checkMySQL() {
  try {
    await getPool().query('SELECT 1');
    return { status: 'good', message: 'MySQL: connected' };
  } catch (e) {
    return { status: 'bad', message: 'MySQL: disconnected' };
  }
}

async function checkGroq() {
  if ((process.env.LLM_PROVIDER || 'ollama').toLowerCase() !== 'groq') {
    return { status: 'good', message: 'LLM: using Ollama (local)' };
  }
  if (!process.env.GROQ_API_KEY) {
    return { status: 'bad', message: 'Groq: GROQ_API_KEY not set' };
  }
  return { status: 'good', message: `Groq: configured (${process.env.GROQ_MODEL || 'llama-3.1-8b-instant'})` };
}

// Route for overall system status (consumed by admin.html status panel)
router.get('/', async (req, res) => {
  try {
    const [mysql, groq, articlesInDB, llmProcessed] = await Promise.all([
      checkMySQL(),
      checkGroq(),
      newsItemRepo.countAll(),
      newsItemRepo.countProcessed()
    ]);

    const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const fallbackCount = getLlmFallbackCount();

    res.json({
      mysql,
      groq,
      llmModel: { status: 'good', message: `${getCurrentModelName()}` },
      rssFeed: { status: 'good', message: 'RSS Feed: external tick, ~every 2 min' },
      llmQueue: { status: 'good', message: `LLM Queue: ${articlesInDB - llmProcessed} pending` },
      fallbackCount: { status: fallbackCount > 0 ? 'warning' : 'good', message: `Fallback Count: ${fallbackCount}` },
      articlesInDB: { status: 'good', message: `Articles in DB: ${articlesInDB}` },
      llmProcessed: { status: 'good', message: `LLM Processed: ${llmProcessed}` },
      cpuUsage: { status: 'good', message: `CPU Usage: ${Math.round(process.cpuUsage().user / 1000000)}s user time` },
      memory: { status: memMb > 2048 ? 'warning' : 'good', message: `Memory: ${memMb} MB` }
    });
  } catch (error) {
    console.error('Error building status response:', error);
    res.status(500).json({ error: 'Failed to build status', details: error.message });
  }
});

// Route to purge the database
router.post('/admin/purge-db', async (req, res) => {
  console.log("Received request to purge database...");
  try {
    // Suspend the external tick's work so it doesn't immediately repopulate
    suspendTicks();

    const deletedCount = await newsItemRepo.deleteAllNewsItems();
    const remainingCount = await newsItemRepo.countAll();

    // Clear the in-memory keyword cache to prevent ghost tags
    clearKeywordCache();

    console.log(`Purge database result: Deleted ${deletedCount}, Remaining: ${remainingCount}`);
    if (remainingCount > 0) {
      console.warn(`[Purge] WARNING: ${remainingCount} items still remain after delete!`);
    }

    res.json({
      message: 'Database purged successfully. Ticks suspended. Use "Force Refresh" to restart.',
      deletedCount,
      remainingCount
    });
  } catch (error) {
    console.error('Error purging database:', error);
    res.status(500).json({ error: 'Failed to purge database', details: error.message });
  }
});

// Route to force refresh all feeds
router.post('/admin/force-refresh', async (req, res) => {
  console.log("Received request to force refresh data...");
  try {
    // Resume the external tick's work
    resumeTicks();

    forceRefreshAllFeeds()
      .then(result => {
        console.log(`Force refresh background process completed: ${JSON.stringify(result)}`);
      })
      .catch(err => {
        console.error('Error during force refresh background process:', err);
      });
    res.status(202).json({ message: 'Force refresh process started successfully. Ticks resumed.' });
  } catch (error) {
    console.error('Error starting force refresh process:', error);
    res.status(500).json({ error: 'Failed to start force refresh process', details: error.message });
  }
});

// Route to get statistics
// (rewritten to tally in JS instead of a Mongo $unwind/$group pipeline -
// data volume here is modest, a few thousand rows, so this stays simple)
router.get('/stats', async (req, res) => {
  console.log("Received request for tag statistics...");
  try {
    const items = await newsItemRepo.findAllProcessedWithKeywords();
    const byCategoryBias = new Map(); // category -> Map(bias -> count)
    for (const item of items) {
      const category = item.category || 'Unknown Category';
      const bias = item.bias || 'Unknown Bias';
      if (!byCategoryBias.has(category)) byCategoryBias.set(category, new Map());
      const biasMap = byCategoryBias.get(category);
      biasMap.set(bias, (biasMap.get(bias) || 0) + item.keywords.length);
    }

    const stats = Array.from(byCategoryBias.entries())
      .map(([category, biasMap]) => {
        const biases = Array.from(biasMap.entries())
          .map(([bias, count]) => ({ bias, count }))
          .sort((a, b) => a.bias.localeCompare(b.bias));
        const totalKeywords = biases.reduce((sum, b) => sum + b.count, 0);
        return { category, biases, totalKeywords };
      })
      .sort((a, b) => a.category.localeCompare(b.category));

    const overallTotal = stats.reduce((sum, categoryStat) => sum + categoryStat.totalKeywords, 0);
    console.log(`Tag statistics generated. Categories: ${stats.length}, Total Keywords: ${overallTotal}`);
    res.json({ stats, overallTotal });
  } catch (error) {
    console.error('Error fetching tag statistics:', error);
    res.status(500).json({ error: 'Failed to fetch tag statistics', details: error.message });
  }
});

// Route to get tag statistics
router.get('/admin/tag-stats', async (req, res) => {
  console.log("Received request for ADMIN tag statistics...");
  try {
    const items = await newsItemRepo.findAllProcessedWithKeywords();
    const tagCategories = new Map(); // keyword -> Set(category)
    const tagBiases = new Map(); // keyword -> Set(bias)
    for (const item of items) {
      const category = item.category || 'Unknown';
      const bias = item.bias || 'Unknown';
      for (const kw of item.keywords) {
        if (!kw) continue;
        if (!tagCategories.has(kw)) tagCategories.set(kw, new Set());
        if (!tagBiases.has(kw)) tagBiases.set(kw, new Set());
        tagCategories.get(kw).add(category);
        tagBiases.get(kw).add(bias);
      }
    }

    const byCategory = {};
    for (const categories of tagCategories.values()) {
      for (const cat of categories) byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    const byBias = {};
    for (const biases of tagBiases.values()) {
      for (const bias of biases) byBias[bias] = (byBias[bias] || 0) + 1;
    }

    res.json({ totalUniqueTags: tagCategories.size, byCategory, byBias });
  } catch (error) {
    console.error('Error fetching admin tag statistics:', error);
    res.status(500).json({ error: 'Failed to fetch tag statistics', details: error.message });
  }
});

// Route to serve admin.html
router.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Route to get available Ollama models
router.get('/ollama-models', async (req, res) => {
  try {
    const ollamaApiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    console.log(`[StatusRoutes] Fetching Ollama models from: ${ollamaApiUrl}/api/tags`);
    const response = await axios.get(`${ollamaApiUrl}/api/tags`, { timeout: 5000 }); // 5 second timeout

    if (response.data && Array.isArray(response.data.models)) {
      // We only need the name of the models for the dropdown
      const modelNames = response.data.models.map(model => ({ name: model.name }));
      res.json(modelNames);
    } else {
      console.error('[StatusRoutes] Unexpected response format from Ollama /api/tags:', response.data);
      res.status(500).json({ error: 'Unexpected response format from Ollama an d API /api/tags' });
    }
  } catch (error) {
    console.error('[StatusRoutes] Error fetching Ollama models:', error.message);
    // Check if it's a timeout or connection error
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      res.status(503).json({ error: `Ollama API (${ollamaApiUrl}) unavailable.`, details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch Ollama models', details: error.message });
    }
  }
});

// Route to set active LLM model
router.post('/set-llm-model', async (req, res) => {
  const { model: newModelName } = req.body;

  if (!newModelName || typeof newModelName !== 'string' || newModelName.trim() === '') {
    return res.status(400).json({ error: 'Invalid model name provided.' });
  }

  const trimmedModelName = newModelName.trim();
  const configPath = path.join(__dirname, '..', 'config', 'llmConfig.json');

  try {
    // Optional: Verify the model exists using Ollama API before setting?
    // This adds latency but prevents setting a non-existent model.
    // For simplicity, we'll skip verification for now, assuming the user selects from the populated list.

    // Read current config
    let config = {};
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (readError) {
      // If file doesn't exist or is invalid, start with an empty object
      console.warn(`[Set LLM Model] Config file ${configPath} not found or invalid. Creating new one.`);
    }

    // Update the model
    config.activeModel = trimmedModelName;

    // Write the updated config back
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    console.log(`[Set LLM Model] Successfully updated active model in ${configPath} to: ${trimmedModelName}`);

    // Dynamically update the model in the running llmService
    const modelUpdatedInMemory = setActiveModel(trimmedModelName);

    if (modelUpdatedInMemory) {
      res.json({
        success: true,
        message: `LLM model set to ${trimmedModelName} and updated in the running service.`
      });
    } else {
      // This case might be hit if setActiveModel returns false (e.g., invalid name, though validated above)
      res.json({
        success: true,
        message: `LLM model configuration updated to ${trimmedModelName}. Restart server if live update failed.`
      });
    }

  } catch (error) {
    console.error(`[Set LLM Model] Error setting LLM model to ${trimmedModelName}:`, error);
    res.status(500).json({ error: 'Failed to set LLM model configuration', details: error.message });
  }
});

module.exports = router;
