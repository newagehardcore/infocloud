/**
 * Startup script for InfoCloud development environment
 * Checks and starts all necessary services:
 * 1. Docker (for Miniflux)
 * 2. Ollama (for LLM integration)
 * 3. MongoDB (for data storage)
 */
const { exec, execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

// Root project directory
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// Function to check if a service is running
const isServiceRunning = (service, command) => {
  try {
    const output = execSync(command).toString();
    return !output.includes('not found') && output.length > 0;
  } catch (error) {
    return false;
  }
};

// Function to run a command and log output
const runCommand = (command, options = {}) => {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { 
      stdio: 'inherit',
      ...options
    });
    return true;
  } catch (error) {
    console.error(`Failed to run: ${command}`);
    console.error(error.message);
    return false;
  }
};

// Check if Docker is running
const isDockerRunning = () => {
  return isServiceRunning('docker', 'docker info 2>/dev/null');
};

// Check if Ollama is running
const isOllamaRunning = () => {
  try {
    // Try to connect to Ollama API
    execSync('curl -s http://localhost:11434/api/version >/dev/null 2>&1');
    return true;
  } catch (error) {
    return false;
  }
};

// Check if Miniflux container is running
const isMinifluxRunning = () => {
  try {
    const output = execSync('docker ps --filter "name=infocloud-miniflux" --format "{{.Status}}"').toString();
    return output.toLowerCase().includes('up');
  } catch (error) {
    return false;
  }
};

// Check if MongoDB is running
const isMongoDBRunning = () => {
  try {
    execSync('nc -z localhost 27017 >/dev/null 2>&1');
    return true;
  } catch (error) {
    return false;
  }
};

// Start Docker if not running
const startDocker = async () => {
  if (!isDockerRunning()) {
    console.log('🐳 Docker is not running. Starting Docker...');
    runCommand('open -a Docker');
    
    // Wait for Docker to start (up to 30 seconds)
    console.log('Waiting for Docker to start...');
    let attempts = 0;
    while (!isDockerRunning() && attempts < 30) {
      execSync('sleep 1');
      attempts++;
      process.stdout.write('.');
    }
    console.log('');
    
    if (isDockerRunning()) {
      console.log('✅ Docker is now running');
      return true;
    } else {
      console.error('❌ Failed to start Docker within timeout');
      return false;
    }
  }
  console.log('✅ Docker is already running');
  return true;
};

// Start Miniflux container
const startMiniflux = async () => {
  if (!isMinifluxRunning()) {
    console.log('📰 Miniflux is not running. Starting Miniflux...');
    try {
      // Start Miniflux container
      runCommand('docker-compose up -d', { cwd: PROJECT_ROOT });
      
      // Wait for Miniflux to start (up to 30 seconds)
      console.log('Waiting for Miniflux to start...');
      let attempts = 0;
      while (!isMinifluxRunning() && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        process.stdout.write('.');
      }
      console.log('');
      
      if (isMinifluxRunning()) {
        console.log('✅ Miniflux is now running');
        return true;
      } else {
        console.error('❌ Failed to start Miniflux within timeout');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to start Miniflux:', error.message);
      return false;
    }
  }
  console.log('✅ Miniflux is already running');
  return true;
};

// Start Ollama if not running
const startOllama = async () => {
  if (!isOllamaRunning()) {
    console.log('🧠 Ollama is not running. Starting Ollama...');
    try {
      // Start Ollama in the background
      const child = exec('ollama serve', { stdio: 'inherit' });
      
      // Wait for Ollama to start (up to 30 seconds)
      console.log('Waiting for Ollama to start...');
      let attempts = 0;
      while (!isOllamaRunning() && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        process.stdout.write('.');
      }
      console.log('');
      
      if (isOllamaRunning()) {
        console.log('✅ Ollama is now running');
        return true;
      } else {
        console.error('❌ Failed to start Ollama within timeout');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to start Ollama:', error.message);
      return false;
    }
  }
  console.log('✅ Ollama is already running');
  return true;
};

// Start MongoDB if needed
const startMongoDB = async () => {
  if (!isMongoDBRunning()) {
    console.log('🍃 MongoDB is not running. Starting MongoDB...');
    try {
      // Start MongoDB
      runCommand('brew services start mongodb-community');
      
      // Wait for MongoDB to start (up to 30 seconds)
      console.log('Waiting for MongoDB to start...');
      let attempts = 0;
      while (!isMongoDBRunning() && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        process.stdout.write('.');
      }
      console.log('');
      
      if (isMongoDBRunning()) {
        console.log('✅ MongoDB is now running');
        return true;
      } else {
        console.error('❌ Failed to start MongoDB within timeout');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to start MongoDB:', error.message);
      return false;
    }
  }
  console.log('✅ MongoDB is already running');
  return true;
};

// Set default environment variables if needed
const setDefaultEnvVars = () => {
  // console.log('[DIAGNOSTIC] setDefaultEnvVars - MONGODB_URI before default:', process.env.MONGODB_URI); // Log before
  if (!process.env.MONGODB_URI) {
    process.env.MONGODB_URI = 'mongodb://localhost:27017';
    console.log('📝 Set default MONGODB_URI: mongodb://localhost:27017');
  }
  
  // console.log('[DIAGNOSTIC] setDefaultEnvVars - DB_NAME before default:', process.env.DB_NAME); // Log before
  if (!process.env.DB_NAME) {
    process.env.DB_NAME = 'news_aggregator';
    console.log('📝 Set default DB_NAME: news_aggregator');
  }
};

// Main startup function
const startup = async () => {
  try {
    console.log('🚀 Starting InfoCloud development environment...');
    
    // 1. Start Docker and ensure it's running
    if (!await startDocker()) {
      throw new Error('Failed to start Docker');
    }
    
    // 2. Start Miniflux container
    if (!await startMiniflux()) {
      throw new Error('Failed to start Miniflux');
    }
    
    // 3. Start MongoDB
    if (!await startMongoDB()) {
      throw new Error('Failed to start MongoDB');
    }
    
    // 4. Start Ollama
    if (!await startOllama()) {
      console.warn('⚠️ Ollama service not available. Some features may be limited.');
    }
    
    // 5. Set default environment variables
    setDefaultEnvVars();
    
    console.log('✅ All services started successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to start services:', error.message);
    return false;
  }
};

// Run the startup if this script is called directly
if (require.main === module) {
  startup();
}

module.exports = { startup };
