const express = require('express');
const path = require('path');
// Explicit path (not the default cwd-relative lookup) for local dev, where
// this loads the repo-root .env; harmless in production, where secrets come
// from real environment variables and no .env file exists at all.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const cors = require('cors'); // Add CORS
const http = require('http'); // 1. Import http module
const WebSocket = require('ws'); // 2. Import ws module
const { connectDB } = require('./db/mysql');
const newsRoutes = require('./routes/news');
const statusRoutes = require('./routes/statusRoutes');
const { requireAdminForWrites, requireAdminAlways, isValidAdminToken } = require('./middleware/adminAuth');
const sourceRoutes = require('./routes/sourceRoutes'); // Import the new source routes
const { runTick } = require('./tick');

const app = express();

// --- WebSocket Server Setup ---
const server = http.createServer(app); // 3. Create HTTP server from Express app
const wss = new WebSocket.Server({
  server,
  path: '/ws/logs',
  // This stream broadcasts every server log line (including, historically,
  // things like DB connection details) to whoever is connected — gate it
  // the same as the rest of the admin surface, not just the API routes.
  verifyClient: (info, done) => {
    const url = new URL(info.req.url, 'http://localhost');
    const token = info.req.headers['x-admin-token'] || url.searchParams.get('token');
    if (isValidAdminToken(token)) return done(true);
    done(false, 401, 'Admin token required');
  }
}); // 4. Create WebSocket server

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

// Init Middleware
app.use(express.json({ extended: false })); // Allows us to accept JSON data in the body

// Enable CORS. ALLOWED_ORIGINS is a comma-separated list of origins the
// static frontend is served from (e.g. https://user.github.io); when unset,
// all origins are allowed (local development).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow these methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token'] // Allow these headers
}));

// TEMP diagnostic: not sensitive (ALLOWED_ORIGINS is a public URL, not a
// secret) — confirms exactly what the live process sees, since env values
// can silently diverge from what was entered in the GoDaddy Secrets UI.
app.get('/api/internal/cors-check', (req, res) => {
  res.json({
    rawEnv: process.env.ALLOWED_ORIGINS ?? null,
    parsedOrigins: allowedOrigins,
    receivedOriginHeader: req.get('origin') ?? null,
  });
});

// Connect to Database and Start Server
console.log('Attempting to connect to database...');
connectDB().then(() => {
  console.log('Database connection successful. Starting server with WebSocket support...');
  // Per the GoDaddy Node.js hosting deploy contract: listen on process.env.PORT
  // (inlined here, not a separate constant, so static port-binding scanners
  // reliably see it) with a local-dev fallback, bound to 0.0.0.0 rather than
  // localhost. server.listen (not app.listen) because the WebSocket upgrade
  // handling above needs the raw http.Server, not just the Express app.
  server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
      originalConsoleLog(`Server started on port ${process.env.PORT || 3000} with WebSocket support for /ws/logs`);
      // Note: Using originalConsoleLog here to avoid an immediate broadcast loop if console.log is used inside this callback before wss is fully ready.
  });
  // No in-process cron here - GoDaddy Node hosting doesn't document
  // background-job support, so an external service hits POST
  // /api/internal/tick on a schedule instead (see routes/statusRoutes.js).
}).catch(err => {
  console.error('Failed to connect to database. Server not started.', err);
  process.exit(1);
});

// Define Routes
app.get('/', (req, res) => res.send('News Backend Running'));

// Mount API routes (non-GET requests require the admin token; see middleware/adminAuth)
app.use('/api/news', requireAdminForWrites, newsRoutes);
app.use('/api/status', requireAdminAlways, statusRoutes); // Admin-only: not called by the public frontend
app.use('/api/sources', requireAdminAlways, sourceRoutes); // Admin-only: not called by the public frontend

// Hit by an external scheduler (e.g. cron-job.org) every ~2 minutes, since
// this platform has no documented in-process background-job support. Guarded
// by its own secret (CRON_SECRET) rather than ADMIN_TOKEN, so a leaked
// scheduler URL can't be used to reach the destructive admin endpoints.
app.post('/api/internal/tick', async (req, res) => {
  const provided = req.get('X-Cron-Secret') || req.query.secret;
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Invalid or missing cron secret.' });
  }
  try {
    const result = await runTick();
    res.json(result);
  } catch (error) {
    console.error('[Tick] Unhandled error:', error);
    res.status(500).json({ message: 'Tick failed', error: error.message });
  }
});

// public/ contains only the admin panel — gate the whole static mount
app.use(requireAdminAlways, express.static(path.join(__dirname, '../public')));

// Serve the admin.html at the /admin route
app.get('/admin', requireAdminAlways, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Basic Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app; // Export for potential testing
