/**
 * Script to fix misclassified source types in the database
 * 
 * This script will:
 * 1. Fetch all sources from the database
 * 2. Apply specific corrections for misclassified sources
 * 3. Update sources with the correct types
 * 
 * Run with: node src/scripts/fix-source-types.js
 */

const mongoose = require('mongoose');
const { SOURCE_TYPES } = require('../utils/constants');
const { getAllSources, updateSource } = require('../services/sourceManagementService');
const { connectDB } = require('../config/db');

// Specific corrections for misclassified sources
const corrections = {
  // News agencies incorrectly classified as STATE
  'bbc': SOURCE_TYPES[1], // CORPORATE (UK license-fee funded but editorially independent)
  'npr': SOURCE_TYPES[1], // CORPORATE (US publicly funded but editorially independent)
  'pbs': SOURCE_TYPES[1], // CORPORATE
  'fox news': SOURCE_TYPES[1], // CORPORATE
  'fox sports': SOURCE_TYPES[1], // CORPORATE
  'fortune': SOURCE_TYPES[1], // CORPORATE
  'courthouse news': SOURCE_TYPES[1], // CORPORATE (private news service)
  'fivethirtyeight': SOURCE_TYPES[1], // CORPORATE (owned by ABC/Disney)
  'barrett sports media': SOURCE_TYPES[1], // CORPORATE 
  'beautiful art': SOURCE_TYPES[1], // CORPORATE
  'big hollywood': SOURCE_TYPES[1], // CORPORATE
  'billboard': SOURCE_TYPES[1], // CORPORATE
  'cbs news': SOURCE_TYPES[1], // CORPORATE
  'cbs sports': SOURCE_TYPES[1], // CORPORATE
  'contemporary art review': SOURCE_TYPES[1], // CORPORATE
  'observer arts': SOURCE_TYPES[1], // CORPORATE
  'public art review': SOURCE_TYPES[1], // CORPORATE
  'nyt - sports': SOURCE_TYPES[1], // CORPORATE
  'yahoo sports': SOURCE_TYPES[1], // CORPORATE
  'sporting news': SOURCE_TYPES[1], // CORPORATE
  'fox': SOURCE_TYPES[1], // CORPORATE
  'france 24': SOURCE_TYPES[1], // CORPORATE (France-based international news)
  'techdirt': SOURCE_TYPES[0], // INDEPENDENT (tech blog)
  'hot air tech': SOURCE_TYPES[0], // INDEPENDENT (tech blog)
  'smithsonian magazine': SOURCE_TYPES[1], // CORPORATE (affiliated with Smithsonian but editorially independent)
  'space intel report': SOURCE_TYPES[1], // CORPORATE
  'the hollywood reporter': SOURCE_TYPES[1], // CORPORATE
  'green car reports': SOURCE_TYPES[1], // CORPORATE

  // Truly STATE media that might be misclassified
  'russia today': SOURCE_TYPES[2], // STATE (Russian government-controlled)
  'rt': SOURCE_TYPES[2], // STATE (Russian government-controlled)
  'al jazeera': SOURCE_TYPES[2], // STATE (Qatar government-funded)
  'xinhua': SOURCE_TYPES[2], // STATE (Chinese government-controlled)
  'cgtn': SOURCE_TYPES[2], // STATE (Chinese government-controlled)
  'tass': SOURCE_TYPES[2], // STATE (Russian government-controlled)
  'ria novosti': SOURCE_TYPES[2], // STATE (Russian government-controlled)
  'press tv': SOURCE_TYPES[2], // STATE (Iranian government-controlled)
  'deutsche welle': SOURCE_TYPES[2], // STATE (German government-funded)
  'dw': SOURCE_TYPES[2], // STATE (German government-funded)
  'bbc': SOURCE_TYPES[1], // CORPORATE (Editorially independent)
  'bbc news': SOURCE_TYPES[1], // CORPORATE
  'bbc sport': SOURCE_TYPES[1], // CORPORATE

  // Independent media that might be misclassified
  'intercept': SOURCE_TYPES[0], // INDEPENDENT
  'propublica': SOURCE_TYPES[0], // INDEPENDENT
  'common dreams': SOURCE_TYPES[0], // INDEPENDENT
  'democracy now': SOURCE_TYPES[0], // INDEPENDENT
  'mother jones': SOURCE_TYPES[0], // INDEPENDENT
  'national review': SOURCE_TYPES[0], // INDEPENDENT
  'jacobin': SOURCE_TYPES[0], // INDEPENDENT
  'reason': SOURCE_TYPES[0], // INDEPENDENT
  'cfact': SOURCE_TYPES[0], // INDEPENDENT
  'carbon brief': SOURCE_TYPES[0], // INDEPENDENT
  'co2 coalition': SOURCE_TYPES[0], // INDEPENDENT
  'balkinization': SOURCE_TYPES[0], // INDEPENDENT (legal blog)
  'behind the black': SOURCE_TYPES[0], // INDEPENDENT (space blog)
  'benedict evans': SOURCE_TYPES[0], // INDEPENDENT (tech analyst)
  'boing boing': SOURCE_TYPES[0], // INDEPENDENT (blog)
  'climate change news': SOURCE_TYPES[0], // INDEPENDENT
  'climate depot': SOURCE_TYPES[0], // INDEPENDENT
  'collider': SOURCE_TYPES[0], // INDEPENDENT (entertainment news)
  'consequence': SOURCE_TYPES[0], // INDEPENDENT (music blog)
  'consequence of sound': SOURCE_TYPES[0], // INDEPENDENT (music blog)
  'daily caller': SOURCE_TYPES[1], // CORPORATE
  'daily kos': SOURCE_TYPES[0], // INDEPENDENT (political blog)
  'dj booth': SOURCE_TYPES[0], // INDEPENDENT (music blog)
};

async function fixSourceTypes() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database successfully!');
    
    console.log('Fetching all sources...');
    const sources = await getAllSources();
    console.log(`Fetched ${sources.length} sources.`);
    
    const updates = [];
    const changedSources = [];
    
    for (const source of sources) {
      const sourceLower = source.name.toLowerCase();
      
      // Check for specific correction
      for (const [key, correctedType] of Object.entries(corrections)) {
        if (sourceLower.includes(key)) {
          // Only update if type is different
          if (source.type !== correctedType) {
            console.log(`Correcting source ${source.name} from ${source.type || 'null'} -> ${correctedType}`);
            changedSources.push({
              name: source.name,
              oldType: source.type,
              newType: correctedType
            });
            updates.push(updateSource(source.id, { type: correctedType }));
          }
          break;
        }
      }
    }
    
    if (updates.length > 0) {
      console.log('Updating sources...');
      await Promise.all(updates);
      
      console.log('Source type corrections complete!');
      console.log('Sources changed:');
      changedSources.forEach(change => {
        console.log(`- ${change.name}: ${change.oldType || 'null'} -> ${change.newType}`);
      });
      console.log(`Total corrections: ${updates.length}`);
    } else {
      console.log('No sources needed correction.');
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
fixSourceTypes(); 