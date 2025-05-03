const express = require('express');
const { exec } = require('child_process');
const mongoose = require('mongoose');
const axios = require('axios');
const { getDB } = require('../config/db');
const { getLlmFallbackCount } = require('../services/wordProcessingService');
const { getCurrentModelName } = require('../services/llmService');
const router = express.Router();

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

// Check MongoDB status using the native driver connection
const checkMongoDB = async () => {
  let status = 'disconnected';
  let error = 'Database connection not established';
  try {
    const db = getDB(); // Get the native DB connection
    // Ping the database admin command to check connection
    const pingResult = await db.admin().ping(); 
    if (pingResult && pingResult.ok === 1) {
      status = 'connected';
      error = null;
    } else {
      error = 'Ping command failed or returned non-ok status';
    }
  } catch (e) {
    // Handle cases where getDB() throws (not initialized) or ping fails
    error = e.message; 
    if (e.message.includes('Cannot read properties of null')) {
      error = 'Database connection not initialized via connectDB()';
    }
  }
  
  return {
    name: 'MongoDB',
    status: status,
    error: error
  };
};

// Check Miniflux status
const checkMiniflux = async () => {
  try {
    // Assuming Miniflux is available on localhost:8080
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
    // Ping Ollama API to check if it's running
    const response = await axios.get('http://localhost:11434/api/tags', { timeout: 3000 });
    ollamaStatus = 'running';
    errorMsg = null;
    
    // Check if the *current* configured model is available
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
    currentModel: currentModel, // Return the configured model name
    modelAvailable: modelAvailable, // Return if it was found
    error: errorMsg
  };
};

// Enhanced API endpoint for the status dashboard
router.get('/api', async (req, res) => {
  try {
    // Get status of all systems
    const dockerStatus = await checkDocker();
    const mongoDBStatus = await checkMongoDB();
    const minifluxStatus = await checkMiniflux();
    const ollamaStatus = await checkOllama(); // Contains model info now
    const llmFallbackCount = getLlmFallbackCount(); // Get the fallback count
    
    // --- Get DB Item Count ---
    let dbItemCount = '-'; 
    if (mongoDBStatus.status === 'connected') {
      try {
        const db = getDB();
        const newsCollection = db.collection('newsitems');
        dbItemCount = await newsCollection.countDocuments({});
      } catch (countError) {
        console.error('Error getting article count from DB:', countError);
        dbItemCount = 'Error';
      }
    }
    // --- End DB Item Count ---
    
    // Get system resource usage
    const osUtil = require('os');
    const cpuCount = osUtil.cpus().length;
    const totalMem = Math.round(osUtil.totalmem() / (1024 * 1024 * 1024));
    const freeMem = Math.round(osUtil.freemem() / (1024 * 1024 * 1024));
    const usedMem = totalMem - freeMem;
    const memPercentage = Math.round((usedMem / totalMem) * 100);
    
    // Format status for the response
    const formatStatus = (statusObj) => {
      let status = 'unknown';
      if (statusObj.status === 'running' || statusObj.status === 'connected') {
        status = 'good';
      } else if (statusObj.status === 'issue detected') {
        status = 'warning';
      } else if (statusObj.status === 'offline' || statusObj.status === 'disconnected') {
        status = 'bad';
      }
      
      return {
        status,
        message: `${statusObj.status}${statusObj.error ? ` (${statusObj.error})` : ''}`
      };
    };
    
    // Prepare response object
    const response = {
      docker: formatStatus(dockerStatus),
      mongodb: formatStatus(mongoDBStatus),
      miniflux: formatStatus(minifluxStatus),
      ollama: formatStatus(ollamaStatus), // Base Ollama status
      llmModel: { // Specific check for the configured model
        status: ollamaStatus.status === 'running' ? (ollamaStatus.modelAvailable ? 'good' : 'warning') : 'bad',
        message: ollamaStatus.status === 'running' 
                   ? `${ollamaStatus.currentModel} (${ollamaStatus.modelAvailable ? 'available' : 'NOT FOUND in Ollama'})`
                   : `Ollama offline - cannot check model ${ollamaStatus.currentModel}`
      },
      llmFallback: {
        status: llmFallbackCount > 0 ? 'warning' : 'good',
        message: `Fallback to traditional NLP occurred ${llmFallbackCount} times since server start.`
      },
      metrics: {
        articlesCount: dbItemCount, // Use the fetched count
        dbItemCount: dbItemCount, // Add explicitly for clarity
        queueSize: 'N/A', // You can implement queue size tracking if needed
        cpuUsage: `${process.cpuUsage().user / 1000000}s`,
        memoryUsage: `${memPercentage}% (${usedMem}GB/${totalMem}GB)`
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    console.error('Status API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Original HTML status page
router.get('/', async (req, res) => {
  try {
    const dockerStatus = await checkDocker();
    const mongoDBStatus = await checkMongoDB();
    const minifluxStatus = await checkMiniflux();
    const ollamaStatus = await checkOllama(); // Contains model info now
    const llmFallbackCount = getLlmFallbackCount(); // Get the fallback count here as well

    // Determine fallback status class and message
    const fallbackStatus = llmFallbackCount > 0 ? 'warning' : 'good';
    const fallbackMessage = `Fallback to traditional NLP occurred ${llmFallbackCount} times since server start.`;

    // Determine LLM model status class and message
    let modelStatusClass = 'status-offline';
    let modelStatusMessage = `Ollama offline - cannot check model ${ollamaStatus.currentModel}`;
    if (ollamaStatus.status === 'running') {
      modelStatusClass = ollamaStatus.modelAvailable ? 'status-running' : 'status-issue';
      modelStatusMessage = `${ollamaStatus.currentModel} (${ollamaStatus.modelAvailable ? 'Available' : 'NOT FOUND'})`;
    }

    const statusHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>InfoCloud Status</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #000;
            color: #fff;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            color: #4CAF50;
            border-bottom: 1px solid #333;
            padding-bottom: 10px;
          }
          .status-card {
            background-color: #111;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 15px;
            border-left: 5px solid;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .status-running { border-left-color: #4CAF50; }
          .status-connected { border-left-color: #4CAF50; }
          .status-issue { border-left-color: #FFC107; }
          .status-offline { border-left-color: #F44336; }
          .status-disconnected { border-left-color: #F44336; }
          
          .service-name {
            font-size: 18px;
            font-weight: bold;
          }
          .service-status {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
          }
          .status-label-running, .status-label-connected { background-color: #1b5e20; color: white; }
          .status-label-issue { background-color: #f57f17; color: black; }
          .status-label-offline, .status-label-disconnected { background-color: #b71c1c; color: white; }
          
          .error-message {
            color: #F44336;
            font-size: 14px;
            margin-top: 5px;
          }
          footer {
            margin-top: 30px;
            color: #555;
            font-size: 12px;
            text-align: center;
          }
          .refresh-button {
            background-color: #2196F3;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 20px;
          }
          .refresh-button:hover {
            background-color: #0b7dda;
          }
          .timestamp {
            color: #777;
            margin-bottom: 20px;
          }
          .model-status {
            font-size: 14px;
            color: #888;
            margin-top: 5px;
          }
          .model-available { color: #4CAF50; }
          .model-unavailable { color: #F44336; }
          .status-good { border-left-color: #4CAF50; }
          .status-warning { border-left-color: #FFC107; }
          .status-bad { border-left-color: #F44336; }
          .status-label-good { background-color: #1b5e20; color: white; }
          .status-label-warning { background-color: #f57f17; color: black; }
          .status-label-bad { background-color: #b71c1c; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>InfoCloud Backend Status</h1>
          
          ${createStatusCard(dockerStatus, 'Docker')}
          ${createStatusCard(mongoDBStatus, 'MongoDB')}
          ${createStatusCard(minifluxStatus, 'Miniflux')}
          ${createStatusCard(ollamaStatus, 'Ollama')} 

          <!-- LLM Model Status Card -->
          <div class="status-card ${modelStatusClass}">
            <span class="service-name">LLM Model</span>
            <span class="service-status status-label-${modelStatusClass.replace('status-', '')}">${modelStatusMessage}</span>
          </div>

          <!-- LLM Fallback Status Card -->
          <div class="status-card status-${fallbackStatus}">
            <span class="service-name">LLM Fallback Usage</span>
            <span class="service-status status-label-${fallbackStatus}">${fallbackMessage}</span>
          </div>

        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(statusHTML);
  } catch (error) {
    res.status(500).send(`Error generating status page: ${error.message}`);
  }
});

// Helper function to generate status card HTML
function createStatusCard(serviceStatus, displayName) {
  const name = displayName || serviceStatus.name;
  let statusClass = 'status-offline'; // Default
  if (serviceStatus.status === 'running' || serviceStatus.status === 'connected') {
    statusClass = 'status-running';
  } else if (serviceStatus.status === 'issue detected') {
    statusClass = 'status-issue';
  } else if (serviceStatus.status === 'disconnected') {
    statusClass = 'status-disconnected';
  }
  
  const statusLabel = serviceStatus.status;
  const errorDetails = serviceStatus.error ? ` - ${serviceStatus.error}` : '';

  return `
    <div class="status-card ${statusClass}">
      <span class="service-name">${name}</span>
      <span class="service-status status-label-${statusClass.replace('status-', '')}">${statusLabel}${errorDetails}</span>
    </div>
  `;
}

module.exports = router;
