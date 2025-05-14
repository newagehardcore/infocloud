/**
 * Script to rebuild the keyword cache with the corrected source types
 * 
 * This script will:
 * 1. Connect to the database
 * 2. Call the aggregateKeywordsForCloud function from wordProcessingService
 * 3. Disconnect from the database when done
 * 
 * Run with: node src/scripts/rebuild-keyword-cache.js
 */

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { aggregateKeywordsForCloud } = require('../services/wordProcessingService');

async function rebuildKeywordCache() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database successfully!');
    
    console.log('Rebuilding keyword cache...');
    await aggregateKeywordsForCloud();
    console.log('Keyword cache rebuilt successfully!');
    
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed.');
    
  } catch (error) {
    console.error('Error rebuilding keyword cache:', error);
    process.exit(1);
  }
}

// Execute the function
rebuildKeywordCache(); 