const express = require('express');
require('dotenv').config(); // Ensure env vars are loaded
const cors = require('cors'); // Add CORS
const { connectDB } = require('./config/db');
const newsRoutes = require('./routes/news');
const { scheduleFeedFetching } = require('./cron'); // Import the scheduler

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'], // Allow these origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow these methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allow these headers
}));

// Connect to Database
connectDB().then(() => {
  // Start the cron job scheduler only after DB connection is successful
  scheduleFeedFetching();
});

// Init Middleware
app.use(express.json({ extended: false })); // Allows us to accept JSON data in the body

// Define Routes
app.get('/', (req, res) => res.send('News Backend Running'));
app.use('/api/news', newsRoutes);

// Basic Error Handling Middleware (can be expanded later)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5001; // Use port from env or default to 5001

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

module.exports = app; // Export for potential testing
