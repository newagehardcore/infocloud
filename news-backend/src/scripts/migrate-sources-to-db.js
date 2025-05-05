// One-time script to migrate sources from master_sources.json to MongoDB

const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const Source = require('../models/Source'); // Adjust path if needed
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); // Load .env

// Correctly import the connectDB function using destructuring
const { connectDB } = require('../config/db'); 

const SOURCES_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'master_sources.json');

async function migrateSources() {
  console.log('Starting source migration...');

  // 1. Connect to DB
  try {
    await connectDB(); // Now this should call the function directly
    console.log('MongoDB Connected for migration...');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  // 2. Read JSON file
  let sourcesFromJson = [];
  try {
    console.log(`Reading sources from: ${SOURCES_FILE_PATH}`);
    const data = await fs.readFile(SOURCES_FILE_PATH, 'utf-8');
    sourcesFromJson = JSON.parse(data);
    console.log(`Read ${sourcesFromJson.length} sources from JSON file.`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: Source JSON file not found at ${SOURCES_FILE_PATH}`);
    } else {
      console.error(`Error reading or parsing JSON file: ${error.message}`);
    }
    await mongoose.disconnect();
    process.exit(1);
  }

  // 3. Migrate to MongoDB
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  console.log('Starting migration to MongoDB...');

  for (const sourceData of sourcesFromJson) {
    try {
      // Basic validation
      if (!sourceData.url || !sourceData.name || !sourceData.category || !sourceData.bias) {
          console.warn(`Skipping source due to missing required fields: ${JSON.stringify(sourceData)}`);
          skippedCount++;
          continue;
      }
      
      // Check if source with this URL already exists in DB
      const existingByUrl = await Source.findOne({ url: sourceData.url });
      if (existingByUrl) {
        console.log(`Skipping source (URL exists in DB): ${sourceData.name} (${sourceData.url})`);
        skippedCount++;
        continue;
      }
      
      // Ensure UUID exists (use existing or generate new)
      const sourceUuid = sourceData.id || uuidv4();
      
      // Check if source with this UUID already exists (in case JSON had duplicates)
      const existingByUuid = await Source.findOne({ uuid: sourceUuid });
       if (existingByUuid) {
        console.log(`Skipping source (UUID exists in DB): ${sourceData.name} (${sourceUuid})`);
        skippedCount++;
        continue;
      }

      // Create and save new Source document
      const newSource = new Source({
        uuid: sourceUuid,
        url: sourceData.url,
        alternateUrl: sourceData.alternateUrl || null,
        name: sourceData.name,
        // Ensure category/bias are uppercase and handle potential nulls
        category: (sourceData.category || 'UNCATEGORIZED').toUpperCase(), 
        bias: (sourceData.bias || 'UNKNOWN').toUpperCase(), 
        // Handle potential null/undefined Miniflux ID
        minifluxFeedId: sourceData.minifluxFeedId !== undefined ? sourceData.minifluxFeedId : null 
      });

      await newSource.save();
      migratedCount++;
      // console.log(`Migrated: ${newSource.name}`); // Optional: log each success

    } catch (error) {
      console.error(`Error migrating source "${sourceData.name || 'N/A'}" (URL: ${sourceData.url || 'N/A'}):`, error.message);
      errorCount++;
    }
  }

  // 4. Report and Disconnect
  console.log('\n--- Migration Summary ---');
  console.log(`Sources in JSON: ${sourcesFromJson.length}`);
  console.log(`Successfully Migrated: ${migratedCount}`);
  console.log(`Skipped (already existed or missing fields): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('-------------------------');

  try {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected.');
  } catch (err) {
    console.error('Error disconnecting from MongoDB:', err.message);
  }

  console.log('Migration process finished.');
  process.exit(errorCount > 0 ? 1 : 0); // Exit with error code if any errors occurred
}

// Run the migration
migrateSources(); 