const express = require('express');
const { exec } = require('child_process');
const mongoose = require('mongoose');
const axios = require('axios');
const { getLlmFallbackCount } = require('../services/wordProcessingService');
const { getCurrentModelName } = require('../services/llmService');
const { forceRefreshAllFeeds } = require('../services/rssService');
const NewsItem = require('../models/NewsItem');
const router = express.Router();
const path = require('path');

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

module.exports = router;
