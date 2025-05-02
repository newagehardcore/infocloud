const express = require('express');
const { exec } = require('child_process');
const mongoose = require('mongoose');
const axios = require('axios');
const { getDB } = require('../config/db');
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

// Check Ollama status
const checkOllama = async () => {
  try {
    // Ping Ollama API to check if it's running
    const response = await axios.get('http://localhost:11434/api/tags', { timeout: 3000 });
    
    // Check if the required model is available
    const modelAvailable = response.data.models && 
                          response.data.models.some(model => model.name === 'gemma:2b');
    
    return {
      name: 'Ollama',
      status: 'running',
      modelStatus: modelAvailable ? 'gemma:2b available' : 'gemma:2b not found',
      error: null
    };
  } catch (error) {
    return {
      name: 'Ollama',
      status: 'offline',
      error: error.message
    };
  }
};

// Enhanced API endpoint for the status dashboard
router.get('/api', async (req, res) => {
  try {
    // Get status of all systems
    const dockerStatus = await checkDocker();
    const mongoDBStatus = await checkMongoDB();
    const minifluxStatus = await checkMiniflux();
    const ollamaStatus = await checkOllama();
    
    // Get article counts from MongoDB (if connected)
    let articlesCount = '-';
    if (mongoDBStatus.status === 'connected') {
      try {
        // *** TODO: Refactor this to use the native driver if NewsItem is not a Mongoose model ***
        // Assuming NewsItem is the model for your articles. If not, this will fail.
        // For now, keep the Mongoose check, but ideally use db.collection('newsitems').countDocuments()
        if (mongoose.models.NewsItem) { 
          articlesCount = await mongoose.models.NewsItem.countDocuments();
        } else {
          // Fallback attempt using native driver if Mongoose model not found
          try {
            const db = getDB();
            articlesCount = await db.collection('newsitems').countDocuments();
          } catch (countError) {
            console.error('Error getting article count with native driver:', countError);
            articlesCount = 'Error';
          }
        }
      } catch (e) {
        console.error('Error getting article count:', e);
        articlesCount = 'Error';
      }
    }
    
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
      ollama: formatStatus(ollamaStatus),
      llmModel: {
        status: ollamaStatus.modelStatus?.includes('available') ? 'good' : 'warning',
        message: ollamaStatus.modelStatus || 'Unknown'
      },
      metrics: {
        articlesCount,
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
    const ollamaStatus = await checkOllama();

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
        </style>
      </head>
      <body>
        <div class="container">
          <h1>InfoCloud System Status</h1>
          <div class="timestamp">Last updated: ${new Date().toLocaleString()}</div>
          
          <!-- Docker Status -->
          <div class="status-card status-${dockerStatus.status === 'running' ? 'running' : 'offline'}">
            <div>
              <div class="service-name">Docker</div>
              ${dockerStatus.error ? `<div class="error-message">${dockerStatus.error}</div>` : ''}
            </div>
            <div class="service-status status-label-${dockerStatus.status}">
              ${dockerStatus.status.toUpperCase()}
            </div>
          </div>
          
          <!-- MongoDB Status -->
          <div class="status-card status-${mongoDBStatus.status}">
            <div>
              <div class="service-name">MongoDB</div>
              ${mongoDBStatus.error ? `<div class="error-message">${mongoDBStatus.error}</div>` : ''}
            </div>
            <div class="service-status status-label-${mongoDBStatus.status}">
              ${mongoDBStatus.status.toUpperCase()}
            </div>
          </div>
          
          <!-- Miniflux Status -->
          <div class="status-card status-${minifluxStatus.status === 'running' ? 'running' : 'offline'}">
            <div>
              <div class="service-name">Miniflux</div>
              ${minifluxStatus.error ? `<div class="error-message">${minifluxStatus.error}</div>` : ''}
            </div>
            <div class="service-status status-label-${minifluxStatus.status === 'running' ? 'running' : 'offline'}">
              ${minifluxStatus.status.toUpperCase()}
            </div>
          </div>
          
          <!-- Ollama Status -->
          <div class="status-card status-${ollamaStatus.status === 'running' ? 'running' : 'offline'}">
            <div>
              <div class="service-name">Ollama</div>
              ${ollamaStatus.error ? `<div class="error-message">${ollamaStatus.error}</div>` : ''}
              ${ollamaStatus.modelStatus ? 
                `<div class="model-status ${ollamaStatus.modelStatus.includes('available') ? 'model-available' : 'model-unavailable'}">
                  ${ollamaStatus.modelStatus}
                </div>` : ''}
            </div>
            <div class="service-status status-label-${ollamaStatus.status === 'running' ? 'running' : 'offline'}">
              ${ollamaStatus.status.toUpperCase()}
            </div>
          </div>
          
          <button class="refresh-button" onclick="window.location.reload()">Refresh Status</button>
          
          <footer>
            InfoCloud System Monitor &copy; ${new Date().getFullYear()}
          </footer>
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

module.exports = router;
