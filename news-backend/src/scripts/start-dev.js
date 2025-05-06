/**
 * Development startup script for InfoCloud
 * Runs the startup checks and then starts the development server
 */
const { exec, execSync } = require('child_process');
const { spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { startup } = require('./startup');
const http = require('http');

// Function to kill process on a given port
function killProcessOnPort(port) {
  console.log(`Attempting to clear port ${port}...`);
  try {
    // Find PID using the port. The '-t' option for lsof gives terse output (just PID).
    const pid = execSync(`lsof -t -i:${port}`, { encoding: 'utf8', stdio: 'pipe' }).trim(); // stdio: 'pipe' to suppress lsof output to console unless we want it
    
    if (pid && !isNaN(pid)) {
      console.log(`Found process ${pid} on port ${port}. Attempting to kill...`);
      execSync(`kill -9 ${pid}`);
      console.log(`Process ${pid} on port ${port} killed.`);
    } else if (pid) {
      // lsof might return column headers or other text if -t isn't fully effective or if multiple PIDs are found in a non-terse way
      // This check is a bit basic, might need refinement based on actual lsof output on error/no process
      console.log(`No specific numeric PID found on port ${port}. lsof output: "${pid}". Assuming port is clear or PID not singularly identifiable.`);
    } else {
      console.log(`No process found on port ${port} (lsof returned empty).`);
    }
  } catch (error) {
    // This catch block will typically be entered if lsof -t -i:<port> finds no process (exits with status 1),
    // or if lsof command itself is not found.
    // We can interpret this as "port is likely clear or lsof had an issue".
    if (error.status === 1 && error.stdout.toString().trim() === '' && error.stderr.toString().trim() === '') {
        //This specific condition for lsof (exit status 1, no stdout, no stderr) means no process was found listening on the port.
        console.log(`No process found listening on port ${port}.`);
    } else {
        console.warn(`[killProcessOnPort] Could not determine if port ${port} is in use or failed to clear it. This might be okay if the port is already free. Error: ${error.message}`);
    }
  }
}

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

      // Open Miniflux RSS reader
      exec('open http://localhost:8080');

      // Open the consolidated admin page
      exec('open http://localhost:5001/admin.html');

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

    // Attempt to kill any existing process on the server port BEFORE starting the new one
    const serverPort = process.env.PORT || 5001;
    killProcessOnPort(serverPort);

    // Start the development server using spawn for better I/O handling
    console.log('🚀 Starting development server using spawn...');
    const serverProcess = spawn('nodemon', ['src/app.js'], {
      stdio: 'inherit', // Inherit stdio streams (stdin, stdout, stderr)
      shell: true // Use shell syntax (useful for finding nodemon in PATH)
    });

    // Wait for server to start and open browser windows
    await checkServerAndOpenBrowsers();

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
