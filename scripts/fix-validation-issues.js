/**
 * Script to fix specific source categorization issues identified in validation
 * 
 * This script will:
 * 1. Connect to the database
 * 2. Apply targeted fixes for misclassified sources
 * 3. Generate a report of changes made
 * 
 * Run with: node scripts/fix-validation-issues.js
 */

const mongoose = require('mongoose');
require('../src/models/Source');
const { connectDB } = require('../src/config/db');

// Define specific corrections to apply
const corrections = {
  // Fix misclassified STATE media
  stateMediaCorrections: [
    // NPR should be STATE (publicly funded)
    { name: 'NPR', type: 'STATE' },
    { name: 'NPR - Health', type: 'STATE' },
    { name: 'NPR - Politics', type: 'STATE' },
    { name: 'NPR - Business', type: 'STATE' },
    { name: 'NPR - Science', type: 'STATE' },
    { name: 'NPR - Entertainment', type: 'STATE' },
    { name: 'NPR Music', type: 'STATE' },
    
    // BBC should be STATE (license fee funded)
    { name: 'BBC', type: 'STATE' },
    { name: 'BBC News', type: 'STATE' },
    { name: 'BBC News - Health', type: 'STATE' },
    { name: 'BBC News - Politics', type: 'STATE' },
    { name: 'BBC News - Technology', type: 'STATE' },
    { name: 'BBC News - Business', type: 'STATE' },
    { name: 'BBC News - Science & Environment', type: 'STATE' },
    { name: 'BBC News - Entertainment & Arts', type: 'STATE' },
    { name: 'BBC Sport', type: 'STATE' },
    { name: 'BBC Asia', type: 'STATE' },
    
    // International state media
    { name: 'Al Jazeera', type: 'STATE' }, // Qatar funded
    { name: 'Russia Today', type: 'STATE' }, // Russian state media
    { name: 'RT', type: 'STATE' }, // Russian state media
    { name: 'Deutsche Welle', type: 'STATE' }, // German public broadcaster
    { name: 'France 24', type: 'STATE' }, // French public broadcaster
    
    // Government/International organizations
    { name: 'NASA', type: 'STATE' }, // US government agency
    { name: 'ESA', type: 'STATE' }, // European Space Agency
    { name: 'WHO News', type: 'STATE' }, // World Health Organization
    { name: 'UN News', type: 'STATE' } // United Nations
  ],
  
  // Fix misclassified CORPORATE media
  corporateMediaCorrections: [
    // Major news networks
    { name: 'ABC News', type: 'CORPORATE' },
    { name: 'ABC News - Health', type: 'CORPORATE' },
    { name: 'ABC News - Politics', type: 'CORPORATE' },
    { name: 'ABC News - World', type: 'CORPORATE' },
    { name: 'ABC News - Technology', type: 'CORPORATE' },
    { name: 'ABC News - Money', type: 'CORPORATE' },
    { name: 'ABC News - Entertainment', type: 'CORPORATE' },
    { name: 'ABC News - Sports', type: 'CORPORATE' },
    
    { name: 'CBS News', type: 'CORPORATE' },
    { name: 'CBS News - Politics', type: 'CORPORATE' },
    { name: 'CBS News - MoneyWatch', type: 'CORPORATE' },
    { name: 'CBS News - Science', type: 'CORPORATE' },
    { name: 'CBS News - Entertainment', type: 'CORPORATE' },
    { name: 'CBS News - Sports', type: 'CORPORATE' },
    { name: 'CBS Sports', type: 'CORPORATE' },
    
    { name: 'CNN', type: 'CORPORATE' },
    { name: 'CNN - Politics', type: 'CORPORATE' },
    { name: 'CNN Business', type: 'CORPORATE' },
    { name: 'CNN - Entertainment', type: 'CORPORATE' },
    { name: 'CNN - Sport', type: 'CORPORATE' },
    
    { name: 'Fox News', type: 'CORPORATE' },
    { name: 'Fox News - Health', type: 'CORPORATE' },
    { name: 'Fox News - Sports', type: 'CORPORATE' },
    { name: 'Fox Sports', type: 'CORPORATE' },
    
    { name: 'NBC News', type: 'CORPORATE' },
    { name: 'NBC News - Health', type: 'CORPORATE' },
    { name: 'NBC News - Politics', type: 'CORPORATE' },
    { name: 'NBC News - World', type: 'CORPORATE' },
    { name: 'NBC News - Business', type: 'CORPORATE' },
    
    // Major newspapers/print media
    { name: 'NYT', type: 'CORPORATE' },
    { name: 'NYT - Health', type: 'CORPORATE' },
    { name: 'NYT - Politics', type: 'CORPORATE' },
    { name: 'NYT - World', type: 'CORPORATE' },
    { name: 'NYT - Technology', type: 'CORPORATE' },
    { name: 'NYT - Business', type: 'CORPORATE' },
    { name: 'NYT - Science', type: 'CORPORATE' },
    { name: 'NYT - Movies', type: 'CORPORATE' },
    { name: 'NYT - Sports', type: 'CORPORATE' },
    
    // Fix misidentified corporate media to INDEPENDENT
    { name: 'Wired - Science', type: 'CORPORATE' },
    { name: 'Barrett Sports Media', type: 'INDEPENDENT' },
    { name: 'New York Post', type: 'CORPORATE' },  // Owned by News Corp
    { name: 'The Wall Street Journal', type: 'CORPORATE' },
    { name: 'The Washington Post', type: 'CORPORATE' },
    { name: 'Japan Times', type: 'INDEPENDENT' }
  ],
  
  // Fix misclassified INDEPENDENT media
  independentMediaCorrections: [
    { name: 'Mother Jones', type: 'INDEPENDENT' },
    { name: 'National Review', type: 'INDEPENDENT' },
    { name: 'Reason', type: 'INDEPENDENT' },
    { name: 'The Intercept', type: 'INDEPENDENT' },
    { name: 'The American Conservative', type: 'INDEPENDENT' },
    { name: 'The Nation', type: 'INDEPENDENT' },
    { name: 'Breitbart News', type: 'INDEPENDENT' },
    { name: 'Daily Wire', type: 'INDEPENDENT' },
    { name: 'Daily Caller', type: 'INDEPENDENT' },
    { name: 'The Federalist', type: 'INDEPENDENT' },
    { name: 'Washington Times', type: 'INDEPENDENT' },
    { name: 'TechCrunch', type: 'CORPORATE' }
  ],
  
  // Fix specific bias issues
  biasCorrections: [
    // Adjust for specific sources with inaccurate bias
    { name: 'The Hill', bias: 'CENTRIST' },
    { name: 'Reuters', bias: 'CENTRIST' },
    { name: 'Associated Press', bias: 'CENTRIST' },
    { name: 'C-SPAN', bias: 'CENTRIST' },
    { name: 'The Wall Street Journal', bias: 'CENTRIST' },
    { name: 'The Economist', bias: 'CENTRIST' },
    { name: 'Financial Times', bias: 'CENTRIST' }
  ]
};

async function fixValidationIssues() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database successfully!');
    
    const Source = mongoose.model('Source');
    
    console.log('Fetching all sources from database...');
    const sources = await Source.find();
    console.log(`Fetched ${sources.length} sources from database.`);
    
    const changesApplied = {
      typeChanges: [],
      biasChanges: []
    };
    
    // Process and apply all type corrections
    const allTypeCorrections = [
      ...corrections.stateMediaCorrections,
      ...corrections.corporateMediaCorrections,
      ...corrections.independentMediaCorrections
    ];
    
    for (const source of sources) {
      // Check for type corrections
      const typeCorrection = allTypeCorrections.find(c => 
        source.name === c.name || 
        source.name.includes(c.name + ' -') || 
        source.name.includes(c.name + ' –')
      );
      
      if (typeCorrection && source.type !== typeCorrection.type) {
        console.log(`Correcting type for ${source.name}: ${source.type} -> ${typeCorrection.type}`);
        
        changesApplied.typeChanges.push({
          id: source._id,
          name: source.name,
          oldType: source.type,
          newType: typeCorrection.type
        });
        
        source.type = typeCorrection.type;
        await source.save();
      }
      
      // Check for bias corrections
      const biasCorrection = corrections.biasCorrections.find(c => 
        source.name === c.name ||
        source.name.includes(c.name + ' -') || 
        source.name.includes(c.name + ' –')
      );
      
      if (biasCorrection && source.bias !== biasCorrection.bias) {
        console.log(`Correcting bias for ${source.name}: ${source.bias} -> ${biasCorrection.bias}`);
        
        changesApplied.biasChanges.push({
          id: source._id,
          name: source.name,
          oldBias: source.bias,
          newBias: biasCorrection.bias
        });
        
        source.bias = biasCorrection.bias;
        await source.save();
      }
    }
    
    // Generate summary report
    console.log('\nCHANGES SUMMARY:');
    console.log(`Type changes: ${changesApplied.typeChanges.length}`);
    console.log(`Bias changes: ${changesApplied.biasChanges.length}`);
    
    if (changesApplied.typeChanges.length > 0) {
      console.log('\nType Changes:');
      changesApplied.typeChanges.forEach(change => {
        console.log(`- ${change.name}: ${change.oldType} -> ${change.newType}`);
      });
    }
    
    if (changesApplied.biasChanges.length > 0) {
      console.log('\nBias Changes:');
      changesApplied.biasChanges.forEach(change => {
        console.log(`- ${change.name}: ${change.oldBias} -> ${change.newBias}`);
      });
    }
    
    // Close the database connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the function
fixValidationIssues(); 