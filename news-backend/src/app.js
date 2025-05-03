const express = require('express');
require('dotenv').config(); // Ensure env vars are loaded
const cors = require('cors'); // Add CORS
const { connectDB } = require('./config/db');
const newsRoutes = require('./routes/news');
const statusRoutes = require('./routes/statusRoutes');
// Import the whole module
const cronService = require('./cron'); 

const app = express();

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
  console.log('Database connection successful. Starting server...');
  app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
  // Start the cron job scheduler using the imported module
  cronService.scheduleFeedFetching(); // Access via property
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

// Basic Error Handling Middleware (can be expanded later)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app; // Export for potential testing
