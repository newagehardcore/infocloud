const express = require('express');
require('dotenv').config(); // Ensure env vars are loaded
const cors = require('cors'); // Add CORS
const http = require('http'); // 1. Import http module
const WebSocket = require('ws'); // 2. Import ws module
const { connectDB } = require('./config/db');
const newsRoutes = require('./routes/news');
const statusRoutes = require('./routes/statusRoutes');
const sourceRoutes = require('./routes/sourceRoutes'); // Import the new source routes
// Import the whole module
const cronService = require('./cron'); 
const path = require('path'); 

const app = express();

// --- WebSocket Server Setup ---
const server = http.createServer(app); // 3. Create HTTP server from Express app
const wss = new WebSocket.Server({ server, path: '/ws/logs' }); // 4. Create WebSocket server

const activeClients = new Set();

wss.on('connection', (ws) => {
    console.log('[WebSocket] Log stream client connected');
    activeClients.add(ws);

    ws.on('message', (message) => {
        // Optional: Handle messages from client if needed in the future
        console.log('[WebSocket] Received from client: %s', message);
    });

    ws.on('close', () => {
        console.log('[WebSocket] Log stream client disconnected');
        activeClients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('[WebSocket] Log stream error:', error);
        activeClients.delete(ws); // Remove on error too
    });

    ws.send('[System] Connection to backend log stream established.');
});

// Function to broadcast logs to all connected WebSocket clients
function broadcastLog(message) {
    activeClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (error) {
                console.error('[WebSocket] Error sending message to client:', error);
            }
        }
    });
}

// Override console.log and console.error to broadcast
const originalConsoleLog = console.log;
console.log = function(...args) {
    originalConsoleLog.apply(console, args); // Keep original console.log behavior
    try {
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try { return JSON.stringify(arg); } catch (e) { return '[Unserializable Object]'; }
            }
            return String(arg);
        }).join(' ');
        broadcastLog(`[LOG] ${message}`);
    } catch (error) {
        originalConsoleLog('[Broadcast Error] Failed to broadcast log:', error);
    }
};

const originalConsoleError = console.error;
console.error = function(...args) {
    originalConsoleError.apply(console, args); // Keep original console.error behavior
    try {
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try { return JSON.stringify(arg); } catch (e) { return '[Unserializable Object]'; }
            }
            return String(arg);
        }).join(' ');
        broadcastLog(`[ERROR] ${message}`);
    } catch (error) {
        originalConsoleError('[Broadcast Error] Failed to broadcast error:', error);
    }
};
// --- End WebSocket Server Setup ---

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'], // Allow these origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow these methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allow these headers
}));

// Connect to Database
const PORT = process.env.PORT || 5001; // Use port from env or default to 5001

// Connect to Database and Start Server
console.log('Attempting to connect to database...');
connectDB().then(() => {
  console.log('Database connection successful. Starting server with WebSocket support...');
  // 5. Use server.listen instead of app.listen
  server.listen(PORT, () => {
      originalConsoleLog(`Server started on port ${PORT} with WebSocket support for /ws/logs`);
      // Note: Using originalConsoleLog here to avoid an immediate broadcast loop if console.log is used inside this callback before wss is fully ready.
  });
  // Start the cron job scheduler using the imported module
  cronService.scheduleCronJobs(); // Corrected function name
}).catch(err => {
  console.error('Failed to connect to database. Server not started.', err);
  process.exit(1);
});

// Init Middleware
app.use(express.json({ extended: false })); // Allows us to accept JSON data in the body

// Serve static files from the public directory
app.use(express.static('public'));

// Define Routes
app.get('/', (req, res) => res.send('News Backend Running'));
app.use('/api/news', newsRoutes);
app.use('/status', statusRoutes);
// --- DEBUGGING --- //
if (statusRoutes.stack) {
  console.log("--- STATUS ROUTES STACK ---");
  statusRoutes.stack.forEach(function(r){
    if (r.route && r.route.path){
      console.log("Registered route in statusRoutes:", r.route.path, Object.keys(r.route.methods).join(', ').toUpperCase());
    }
  });
  console.log("-------------------------");
} else {
  console.log("--- DEBUG: statusRoutes.stack is undefined ---");
}
// --- END DEBUGGING --- //
app.use('/api/sources', sourceRoutes); // Mount the source routes

// Serve the new admin.html at the /admin route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Basic Error Handling Middleware (can be expanded later)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app; // Export for potential testing
