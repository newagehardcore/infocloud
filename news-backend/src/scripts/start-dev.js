/**
 * Development startup script for InfoCloud
 * Runs the startup checks and then starts the development server
 */
const { startup } = require('./startup');
const { spawn } = require('child_process');
const path = require('path');

// Run the startup process first
const run = async () => {
  try {
    // Ensure all required services are running
    await startup();
    
    // Clear the database if requested
    console.log('🧹 Clearing database...');
    const clearDbPath = path.resolve(__dirname, '../../clear-db.js');
    require(clearDbPath);
    
    // Start the application with nodemon
    console.log('🚀 Starting development server...');
    const nodemon = spawn('nodemon', ['src/app.js'], { 
      stdio: 'inherit',
      shell: true
    });
    
    // Handle nodemon exit
    nodemon.on('exit', (code) => {
      console.log(`Nodemon exited with code ${code}`);
    });
    
    // Handle nodemon error
    nodemon.on('error', (err) => {
      console.error('Failed to start nodemon:', err);
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('Received SIGINT. Shutting down...');
      nodemon.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error during startup:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  run();
}

module.exports = { run };
