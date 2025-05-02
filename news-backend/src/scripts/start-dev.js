/**
 * Development startup script for InfoCloud
 * Runs the startup checks and then starts the development server
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { startup } = require('./startup');
const http = require('http');

const checkServerAndOpenBrowsers = async () => {
  const maxRetries = 30;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // Try to connect to the server
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:5001', (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Server returned status code ${res.statusCode}`));
          }
        });
        req.on('error', reject);
      });

      // If we get here, the server is running
      console.log('✅ Server is running, opening browser windows...');

      // Open the main application
      exec('open http://localhost:3000');

      // Open the status dashboard
      exec('open http://localhost:5001/status.html');

      // Open Miniflux RSS reader
      exec('open http://localhost:8080');

      return true;
    } catch (error) {
      retries++;
      if (retries < maxRetries) {
        console.log(`Waiting for server to start... (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('❌ Failed to connect to server after multiple attempts');
        return false;
      }
    }
  }
};

const startDev = async () => {
  try {
    // Start all required services
    const servicesStarted = await startup();
    if (!servicesStarted) {
      console.error('❌ Failed to start required services');
      process.exit(1);
    }

    // Start the development server
    console.log('🚀 Starting development server...');
    const server = exec('nodemon src/app.js', { stdio: 'inherit' });

    // Wait for server to start and open browser windows
    await checkServerAndOpenBrowsers();

    // Handle server process
    server.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      process.exit(code);
    });

  } catch (error) {
    console.error('❌ Error during startup:', error);
    process.exit(1);
  }
};

startDev();
