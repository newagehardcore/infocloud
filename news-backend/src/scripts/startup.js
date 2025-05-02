/**
 * Startup script for InfoCloud development environment
 * Checks and starts all necessary services:
 * 1. Docker (for Miniflux)
 * 2. Ollama (for LLM integration)
 * 3. MongoDB (for data storage)
 */
const { exec, execSync } = require('child_process');
const path = require('path');
require('dotenv').config();

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
const startDocker = () => {
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
const startMiniflux = () => {
  if (!isMinifluxRunning()) {
    console.log('📰 Miniflux is not running. Starting Miniflux...');
    runCommand('docker-compose up -d', { cwd: PROJECT_ROOT });
    
    // Wait for Miniflux to start (up to 30 seconds)
    console.log('Waiting for Miniflux to start...');
    let attempts = 0;
    while (!isMinifluxRunning() && attempts < 30) {
      execSync('sleep 1');
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
  }
  console.log('✅ Miniflux is already running');
  return true;
};

// Start Ollama if not running
const startOllama = () => {
  if (!isOllamaRunning()) {
    console.log('🧠 Ollama is not running. Starting Ollama with optimized settings...');
    
    // Start Ollama in the background
    const child = exec('OLLAMA_CONCURRENCY=4 ollama serve >/dev/null 2>&1 &');
    
    // Wait for Ollama to start (up to 10 seconds)
    console.log('Waiting for Ollama to start...');
    let attempts = 0;
    while (!isOllamaRunning() && attempts < 10) {
      execSync('sleep 1');
      attempts++;
      process.stdout.write('.');
    }
    console.log('');
    
    if (isOllamaRunning()) {
      console.log('✅ Ollama is now running');
      
      // Check if the model is available
      try {
        const modelOutput = execSync('ollama list').toString();
        if (!modelOutput.includes('gemma:2b')) {
          console.log('ℹ️ Required model (gemma:2b) not found. You may need to run:');
          console.log('   ollama pull gemma:2b');
        }
      } catch (error) {
        console.log('⚠️ Could not check for Ollama models');
      }
      
      return true;
    } else {
      console.error('❌ Failed to start Ollama within timeout');
      return false;
    }
  }
  console.log('✅ Ollama is already running');
  return true;
};

// Start MongoDB if needed
const startMongoDB = () => {
  if (!isMongoDBRunning()) {
    console.log('🍃 MongoDB is not running. Starting MongoDB...');
    runCommand('brew services start mongodb-community 2>/dev/null || mongod --dbpath ~/data/db --fork --logpath /dev/null');
    
    // Wait for MongoDB to start (up to 10 seconds)
    console.log('Waiting for MongoDB to start...');
    let attempts = 0;
    while (!isMongoDBRunning() && attempts < 10) {
      execSync('sleep 1');
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
  }
  console.log('✅ MongoDB is already running');
  return true;
};

// Set default environment variables if needed
const setDefaultEnvVars = () => {
  if (!process.env.MONGODB_URI) {
    process.env.MONGODB_URI = 'mongodb://localhost:27017';
    console.log('📝 Set default MONGODB_URI: mongodb://localhost:27017');
  }
  
  if (!process.env.DB_NAME) {
    process.env.DB_NAME = 'news_aggregator';
    console.log('📝 Set default DB_NAME: news_aggregator');
  }
};

// Main startup function
const startup = async () => {
  console.log('🚀 Starting InfoCloud development environment...');
  
  // Start services in order
  const dockerStarted = startDocker();
  if (!dockerStarted) {
    console.error('⛔ Cannot continue without Docker. Please start Docker manually.');
    process.exit(1);
  }
  
  const minifluxStarted = startMiniflux();
  const ollamaStarted = startOllama();
  const mongoStarted = startMongoDB();
  
  setDefaultEnvVars();
  
  console.log('\n🎉 InfoCloud environment is ready!');
  
  if (!minifluxStarted || !ollamaStarted || !mongoStarted) {
    console.warn('⚠️ Some services failed to start. Check the logs above.');
  }
};

// Run the startup if this script is called directly
if (require.main === module) {
  startup();
}

module.exports = { startup };
