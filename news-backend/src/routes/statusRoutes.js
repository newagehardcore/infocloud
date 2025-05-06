const express = require('express');
const { exec } = require('child_process');
const mongoose = require('mongoose');
const axios = require('axios');
const { getLlmFallbackCount } = require('../services/wordProcessingService');
const { getCurrentModelName, setActiveModel } = require('../services/llmService');
const { forceRefreshAllFeeds } = require('../services/rssService');
const NewsItem = require('../models/NewsItem');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises; // Use fs.promises

// Check Docker status
const checkDocker = () => {
  return new Promise((resolve) => {
    exec('docker info', (error) => {
      resolve({ 
        name: 'Docker', 
        status: error ? 'offline' : 'running',
        error: error ? error.message : null
      });
    });
  });
};

// Check MongoDB status using Mongoose connection state
const checkMongoDB = async () => {
  const state = mongoose.connection.readyState;
  let status = 'unknown';
  let error = null;

  // Mongoose readyStates:
  // 0: disconnected
  // 1: connected
  // 2: connecting
  // 3: disconnecting
  // 99: uninitialized

  switch (state) {
    case 0: // disconnected
      status = 'disconnected';
      error = 'Mongoose disconnected';
      break;
    case 1: // connected
      status = 'connected';
      break;
    case 2: // connecting
      status = 'connecting';
      break;
    case 3: // disconnecting
      status = 'disconnecting';
      break;
    case 99: // uninitialized
    default:
      status = 'uninitialized';
      error = 'Mongoose connection not initialized or in unknown state';
      break;
  }
  
  // Optional: Try a lightweight operation like count if connected, 
  // but readyState is generally reliable.
  if (status === 'connected') {
      try {
          // Example: Check if the NewsItem model is registered
          await NewsItem.estimatedDocumentCount(); 
      } catch(e) {
          status = 'issue detected';
          error = `Connection reported OK, but operation failed: ${e.message}`;
    }
  }
  
  return {
    name: 'MongoDB (Mongoose)',
    status: status,
    error: error
  };
};

// Check Miniflux status
const checkMiniflux = async () => {
  try {
    const response = await axios.get('http://localhost:8080/healthcheck', { timeout: 3000 });
    return {
      name: 'Miniflux',
      status: response.status === 200 ? 'running' : 'issue detected',
      error: null
    };
  } catch (error) {
    return {
      name: 'Miniflux',
      status: 'offline',
      error: error.message
    };
  }
};

// Check Ollama status and the currently configured model
const checkOllama = async () => {
  const currentModel = getCurrentModelName(); // Get the configured model name
  let modelAvailable = false;
  let ollamaStatus = 'offline';
  let errorMsg = 'Unknown error';

  try {
    const response = await axios.get('http://localhost:11434/api/tags', { timeout: 3000 });
    ollamaStatus = 'running';
    errorMsg = null;
    
    if (response.data.models && Array.isArray(response.data.models)) {
      modelAvailable = response.data.models.some(model => model.name.startsWith(currentModel));
    }
    
  } catch (error) {
    errorMsg = error.message;
    ollamaStatus = 'offline';
  }

  return {
    name: 'Ollama',
    status: ollamaStatus,
    currentModel: currentModel,
    modelAvailable: modelAvailable,
    error: errorMsg
  };
};

// Enhanced API endpoint for the status dashboard
router.get('/api', async (req, res) => {
  try {
    const dockerStatus = await checkDocker();
    const mongoDBStatus = await checkMongoDB();
    const minifluxStatus = await checkMiniflux();
    const ollamaStatus = await checkOllama();
    const llmFallbackCount = getLlmFallbackCount();
    
    let dbItemCount = '-'; 
    let processedItemCount = '-';
    if (mongoDBStatus.status === 'connected') {
      try {
        [dbItemCount, processedItemCount] = await Promise.all([
          NewsItem.countDocuments({}),
          NewsItem.countDocuments({ llmProcessed: true })
        ]);
      } catch (countError) {
        console.error('Error getting article counts from DB:', countError);
        dbItemCount = 'Error';
        processedItemCount = 'Error';
      }
    }
    
    const osUtil = require('os');
    const cpuCount = osUtil.cpus().length;
    const totalMem = Math.round(osUtil.totalmem() / (1024 * 1024 * 1024));
    const freeMem = Math.round(osUtil.freemem() / (1024 * 1024 * 1024));
    const usedMem = totalMem - freeMem;
    const memPercentage = Math.round((usedMem / totalMem) * 100);
    
    const formatStatus = (statusObj) => {
      let status = 'unknown';
      if (statusObj.status === 'running' || statusObj.status === 'connected') status = 'good';
      else if (statusObj.status === 'issue detected' || statusObj.status === 'connecting' || statusObj.status === 'disconnecting') status = 'warning';
      else if (statusObj.status === 'offline' || statusObj.status === 'disconnected' || statusObj.status === 'uninitialized') status = 'bad';
      return { status, message: `${statusObj.name}: ${statusObj.status}${statusObj.error ? ` (${statusObj.error})` : ''}` };
    };
    
    const response = {
      docker: formatStatus(dockerStatus),
      mongodb: formatStatus(mongoDBStatus),
      miniflux: formatStatus(minifluxStatus),
      ollama: formatStatus(ollamaStatus),
      llmModel: {
        status: ollamaStatus.status === 'running' ? (ollamaStatus.modelAvailable ? 'good' : 'warning') : 'bad',
        message: `${ollamaStatus.currentModel}: ${ollamaStatus.status === 'running' 
                   ? (ollamaStatus.modelAvailable ? 'Available' : 'NOT FOUND') 
                   : 'Ollama offline'}`
      },
      llmFallback: {
        status: llmFallbackCount > 0 ? 'warning' : 'good',
        message: `Fallback count: ${llmFallbackCount}`
      },
      metrics: {
        articlesCount: dbItemCount,
        dbItemCount: dbItemCount,
        processedItemCount: processedItemCount,
        queueSize: 'N/A',
        cpuUsage: `${(process.cpuUsage().user / 1000000).toFixed(2)}s`,
        memoryUsage: `${(process.memoryUsage().rss / (1024 * 1024)).toFixed(1)} MB`
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    console.error('Status API error:', error);
    res.status(500).json({ error: 'Failed to fetch status', details: error.message });
  }
});

// Route to purge the database
router.post('/api/admin/purge-db', async (req, res) => {
    console.log("Received request to purge database...");
    try {
        const result = await NewsItem.deleteMany({});
        console.log("Purge database result:", result);
        res.json({ message: 'Database purged successfully', deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Error purging database:', error);
        res.status(500).json({ error: 'Failed to purge database', details: error.message });
    }
});

// Route for Force Refresh
router.post('/api/admin/force-refresh', async (req, res) => {
    console.log("Received request to force refresh data...");
    try {
        forceRefreshAllFeeds()
            .then(result => {
                console.log(`Force refresh background process completed: Processed ${result.processedCount}, Errors ${result.errorCount}`);
            })
            .catch(err => {
                console.error('Error during force refresh background process:', err);
            });
        res.status(202).json({ message: 'Force refresh process started successfully. It will run in the background.' });
    } catch (error) {
        console.error('Error starting force refresh process:', error);
        res.status(500).json({ error: 'Failed to start force refresh process', details: error.message });
    }
});

// NEW: Route to get keyword statistics by category and bias
router.get('/api/stats', async (req, res) => {
    console.log("Received request for tag statistics...");
    try {
        const stats = await NewsItem.aggregate([
            {
                $match: { llmProcessed: true, keywords: { $exists: true, $ne: [] } } // Only processed items with keywords
            },
            {
                $unwind: "$keywords" // One document per keyword
            },
            {
                $group: {
                    _id: {
                        // Use sourceCategory or a default if missing
                        category: { $ifNull: ["$sourceCategory", "Unknown Category"] }, 
                        // Use llmBias or a default if missing
                        bias: { $ifNull: ["$llmBias", "Unknown Bias"] } 
                    },
                    count: { $sum: 1 } // Count keywords per category/bias group
                }
            },
            {
                $group: {
                    _id: "$_id.category", // Group again by category
                    biases: {
                        $push: { // Create an array of bias objects
                            bias: "$_id.bias",
                            count: "$count"
                        }
                    },
                    totalKeywords: { $sum: "$count" } // Sum counts for the category total
                }
            },
            {
                $project: { // Reshape the output
                    _id: 0,
                    category: "$_id",
                    biases: { // Sort the biases within each category for consistency
                        $sortArray: {
                            input: "$biases",
                            sortBy: { bias: 1 } // Sort by bias name ascending
                        }
                    },
                    totalKeywords: 1
                }
            },
            {
                $sort: { category: 1 } // Sort categories alphabetically
            }
        ]);

        // Calculate overall total
        const overallTotal = stats.reduce((sum, categoryStat) => sum + categoryStat.totalKeywords, 0);

        console.log(`Tag statistics generated. Categories: ${stats.length}, Total Keywords: ${overallTotal}`);
        res.json({ stats, overallTotal });

  } catch (error) {
        console.error('Error fetching tag statistics:', error);
        res.status(500).json({ error: 'Failed to fetch tag statistics', details: error.message });
    }
});

// NEW: Route for Admin Panel Tag Statistics
router.get('/api/admin/tag-stats', async (req, res) => {
    console.log("Received request for ADMIN tag statistics...");
    try {
        const results = await NewsItem.aggregate([
            // 1. Filter for processed items with keywords
            { $match: { llmProcessed: true, keywords: { $exists: true, $ne: [] } } },
            // 2. Unwind keywords
            { $unwind: "$keywords" },
            // 3. Filter out empty keywords
            { $match: { keywords: { $ne: "" } } },
            // 4. Group by keyword to get unique tags and their associated data
            {
                $group: {
                    _id: "$keywords",
                    categories: { $addToSet: "$source.category" },
                    biases: { $addToSet: "$bias" }
                }
            },
            // 5. Use $facet to calculate multiple stats in parallel
            {
                $facet: {
                    "totalTags": [
                        { $count: "count" } // Total unique tags
                    ],
                    "byCategory": [
                        { $unwind: "$categories" }, // Unwind the categories array for each tag
                        { $group: { _id: "$categories", count: { $sum: 1 } } }, // Group by category and count tags
                        { $sort: { _id: 1 } } // Sort categories alphabetically
                    ],
                    "byBias": [
                        { $unwind: "$biases" }, // Unwind the biases array for each tag
                        { $group: { _id: "$biases", count: { $sum: 1 } } }, // Group by bias and count tags
                        { $sort: { _id: 1 } } // Sort biases alphabetically
                    ]
                }
            },
            // 6. Project to reshape the output
            {
                $project: {
                    _id: 0,
                    totalUniqueTags: { $arrayElemAt: ["$totalTags.count", 0] }, // Extract total count
                    byCategory: { // Convert array [{_id: CAT, count: N}, ...] to object { CAT: N, ... }
                        $arrayToObject: {
                            $map: {
                                input: "$byCategory",
                                as: "catStat",
                                in: { k: "$$catStat._id", v: "$$catStat.count" }
                            }
                        }
                    },
                    byBias: { // Convert array [{_id: BIAS, count: N}, ...] to object { BIAS: N, ... }
                         $arrayToObject: {
                            $map: {
                                input: "$byBias",
                                as: "biasStat",
                                in: { k: "$$biasStat._id", v: "$$biasStat.count" }
                            }
                        }
                    }
                }
            }
        ]);

        // Aggregation with $facet always returns an array with one document (even if empty)
        const finalStats = results[0] || { totalUniqueTags: 0, byCategory: {}, byBias: {} }; 
        // Add default 0 if totalUniqueTags is missing (no tags found)
        if (finalStats.totalUniqueTags === undefined) {
            finalStats.totalUniqueTags = 0;
        }

        res.json(finalStats);

    } catch (error) {
        console.error('Error fetching admin tag statistics:', error);
        res.status(500).json({ error: 'Failed to fetch tag statistics', details: error.message });
    }
});

// Route to serve the admin status page
router.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// <<< NEW Route to get Ollama models (Corrected Path) >>>
router.get('/ollama-models', async (req, res) => {
  console.log('>>> DEBUG: /status/ollama-models route HIT! <<<');

  try {
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    console.log(`>>> DEBUG: Attempting to fetch models from Ollama at: ${ollamaBaseUrl}/api/tags <<<`);
    const response = await axios.get(`${ollamaBaseUrl}/api/tags`, { timeout: 5000 });

    console.log('>>> DEBUG: Ollama response status:', response.status);
    console.log('>>> DEBUG: Ollama response data:', JSON.stringify(response.data, null, 2));

    if (response.data && Array.isArray(response.data.models)) {
        console.log('>>> DEBUG: Successfully found models array. Sending to frontend. <<<');
        res.json(response.data.models);
    } else {
        console.warn('>>> WARN: Ollama API response for /api/tags did not contain a models array or data was unexpected. Sending empty array to frontend. <<<', response.data);
        res.json([]);
    }
  } catch (error) {
      console.error('>>> ERROR: Error fetching Ollama models: <<<', error.message);
      if (error.response) {
          console.error('>>> ERROR: Ollama error response data: <<<', error.response.data);
          console.error('>>> ERROR: Ollama error response status: <<<', error.response.status);
      } else if (error.request) {
          console.error('>>> ERROR: No response received from Ollama. Request details: <<<', error.request);
      } else {
          console.error('>>> ERROR: Axios request setup error: <<<', error.message);
      }
      res.status(500).json({ error: 'Failed to fetch Ollama models', details: error.code || error.message });
  }
});

// <<< NEW Route to SET Ollama model (Corrected Path) >>>
router.post('/api/set-llm-model', async (req, res) => {
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
