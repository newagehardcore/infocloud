/**
 * Script to test source export and import functionality
 * specifically to verify that the type field is correctly included
 */

const mongoose = require('mongoose');
const { exportAllSources } = require('../src/services/sourceManagementService');
const { connectDB } = require('../src/config/db');
const fs = require('fs').promises;
const path = require('path');

async function testSourceExportImport() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    
    console.log('Exporting all sources...');
    const sources = await exportAllSources();
    
    console.log(`Exported ${sources.length} sources.`);
    
    // Check if type field is included in exports
    if (sources.length > 0) {
      const hasTypeField = sources.some(source => source.type !== undefined);
      console.log(`Type field is ${hasTypeField ? 'included' : 'NOT included'} in exported sources.`);
      
      // Print a sample of sources to see their structure
      console.log('\nSample of exported sources:');
      const sampleSize = Math.min(3, sources.length);
      for (let i = 0; i < sampleSize; i++) {
        console.log(`Source ${i + 1}:`);
        console.log(`  Name: ${sources[i].name}`);
        console.log(`  Category: ${sources[i].category}`);
        console.log(`  Bias: ${sources[i].bias}`);
        console.log(`  Type: ${sources[i].type}`);
      }
      
      // Save exports to a file for manual inspection
      const exportPath = path.join(__dirname, 'test_sources_export.json');
      await fs.writeFile(exportPath, JSON.stringify(sources, null, 2));
      console.log(`\nExported sources saved to ${exportPath}`);
    } else {
      console.log('No sources found to export.');
    }
  } catch (error) {
    console.error('Error testing source export/import:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

// Run the test
testSourceExportImport(); 