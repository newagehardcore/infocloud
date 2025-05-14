/**
 * Script to update source media types in the database
 * 
 * This script will:
 * 1. Load the audited sources with media types from sources_with_type.json
 * 2. Fetch all sources from the database
 * 3. Update each source with the appropriate media type (CORPORATE, INDEPENDENT, STATE)
 * 
 * Run with: node scripts/update-source-types.js
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('../src/models/Source');
const { connectDB } = require('../src/config/db');

// Path to the sources with type file
const sourcesWithTypePath = path.join(__dirname, '../sources_with_type.json');

// Check if the sources with type file exists
if (!fs.existsSync(sourcesWithTypePath)) {
  console.error('Error: sources_with_type.json not found!');
  console.error('Please run the audit-source-types.js script first.');
  process.exit(1);
}

// Load the sources with type
const sourcesWithType = JSON.parse(fs.readFileSync(sourcesWithTypePath, 'utf8'));

// Build a map of URL to type for quick lookup
const urlToTypeMap = {};
for (const source of sourcesWithType) {
  urlToTypeMap[source.url] = source.type;
}

async function updateSourceTypes() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database successfully!');
    
    const Source = mongoose.model('Source');
    
    console.log('Fetching all sources from database...');
    const sources = await Source.find();
    console.log(`Fetched ${sources.length} sources from database.`);
    
    const updates = [];
    const changedSources = [];
    let unchanged = 0;
    let noTypeFound = 0;
    
    for (const source of sources) {
      // Skip sources that already have a type other than UNKNOWN
      if (source.type && source.type !== 'UNKNOWN') {
        unchanged++;
        continue;
      }
      
      // Find the type for this source
      const type = urlToTypeMap[source.url];
      
      if (!type) {
        console.log(`No type found for source: ${source.name} (${source.url})`);
        noTypeFound++;
        continue;
      }
      
      console.log(`Updating source ${source.name} from ${source.type || 'null'} -> ${type}`);
      changedSources.push({
        name: source.name,
        oldType: source.type,
        newType: type
      });
      
      source.type = type;
      updates.push(source.save());
    }
    
    if (updates.length > 0) {
      console.log('Updating sources in database...');
      await Promise.all(updates);
      
      console.log('\nSource type updates complete!');
      console.log('Sources changed:');
      changedSources.forEach(change => {
        console.log(`- ${change.name}: ${change.oldType || 'null'} -> ${change.newType}`);
      });
      console.log(`\nSummary:`);
      console.log(`- Total sources processed: ${sources.length}`);
      console.log(`- Already had valid type: ${unchanged}`);
      console.log(`- No type found: ${noTypeFound}`);
      console.log(`- Total updates: ${updates.length}`);
    } else {
      console.log('No sources needed update.');
    }
    
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the function
updateSourceTypes(); 