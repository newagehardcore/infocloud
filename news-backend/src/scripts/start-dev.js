/**
 * Development startup script for InfoCloud
 * Runs the startup checks and then starts the development server
 */
const { exec } = require('child_process');
const { spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { startup } = require('./startup');
const http = require('http');

// CONFIGURATION:
// Set to true to open specific browser windows automatically
const CONFIG = {
  OPEN_FRONTEND: false, // Set to true to automatically open the frontend
  OPEN_ADMIN: false     // Set to true to automatically open the admin page
};

const checkServerStatus = async () => {
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
      console.log('✅ Server is running!');
      console.log('\n---------------------------------------------');
      console.log('🌐 Your application is running at:');
      console.log('   Frontend: http://localhost:3000');
      console.log('   Admin UI: http://localhost:5001/admin.html');
      console.log('---------------------------------------------');
      console.log('⚠️  IMPORTANT: If you have existing browser tabs open,');
      console.log('   you may need to manually refresh them to reconnect to');
      console.log('   the new server instance and avoid stale connections.');
      console.log('---------------------------------------------\n');
      
      // Open browser windows based on configuration
      if (CONFIG.OPEN_FRONTEND) {
        console.log('Opening frontend in browser...');
        exec('open http://localhost:3000');
      }
      
      if (CONFIG.OPEN_ADMIN) {
        console.log('Opening admin page in browser...');
        exec('open http://localhost:5001/admin.html');
      }

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

    // Start the development server using spawn for better I/O handling
    console.log('🚀 Starting development server using spawn...');
    const serverProcess = spawn('nodemon', ['src/app.js'], {
      stdio: 'inherit', // Inherit stdio streams (stdin, stdout, stderr)
      shell: true // Use shell syntax (useful for finding nodemon in PATH)
    });

    // Wait for server to start and check status
    await checkServerStatus();

    // Handle server process events
    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      process.exit(code);
    });
    serverProcess.on('error', (err) => {
      console.error('❌ Failed to start server process:', err);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Error during startup:', error);
    process.exit(1);
  }
};

startDev();
