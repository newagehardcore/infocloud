/**
 * Script to validate source categorization in the database
 * 
 * This script will:
 * 1. Fetch all sources from the database
 * 2. Check for potential inconsistencies in category, bias, and media type assignments
 * 3. Generate a report of sources that may need manual review
 * 
 * Run with: node scripts/validate-source-categorization.js
 */

const mongoose = require('mongoose');
require('../src/models/Source');
const { connectDB } = require('../src/config/db');
const fs = require('fs');
const path = require('path');

// Define known patterns for validation
const validationRules = {
  // Sources that should likely be STATE based on name patterns
  stateMediaPatterns: [
    'BBC', 'NPR', 'PBS', 'VOA', 'Russia Today', 'RT', 'Al Jazeera', 'Deutsche Welle',
    'CBC', 'ABC Australia', 'NHK', 'France 24', 'NASA', 'ESA', 'WHO', 'UN',
    'Xinhua', 'CGTN', 'Kyodo News', 'TRT World', 'Press TV'
  ],
  
  // Sources that should likely be CORPORATE based on name patterns
  corporateMediaPatterns: [
    'ABC News', 'NBC News', 'CBS News', 'Fox News', 'CNN', 'MSNBC', 'BBC News',
    'NYT', 'Washington Post', 'Wall Street Journal', 'WSJ', 'CNBC', 'Bloomberg',
    'Time', 'Fortune', 'Forbes', 'Newsweek', 'The Atlantic', 'The Economist',
    'Reuters', 'Associated Press', 'USA Today', 'Financial Times', 'Guardian',
    'Politico', 'Vox', 'The Hill', 'The New Yorker', 'Vanity Fair', 'Rolling Stone',
    'ESPN', 'Sports Illustrated', 'TMZ', 'Variety', 'Hollywood Reporter', 'Deadline',
    'Billboard', 'WIRED', 'CNET', 'The Verge', 'TechCrunch', 'MarketWatch', 'Yahoo'
  ],
  
  // Expected bias patterns based on categories
  expectedBiasPatterns: {
    // Some news sources commonly associated with specific bias categories
    liberalSources: [
      'MSNBC', 'CNN', 'NYT', 'Washington Post', 'Huffington Post', 'HuffPost', 'Mother Jones',
      'The Atlantic', 'Vox', 'The Guardian', 'BBC', 'NPR', 'Slate', 'The New Yorker'
    ],
    conservativeSources: [
      'Fox News', 'Breitbart', 'The Federalist', 'Daily Wire', 'Daily Caller', 'Washington Times',
      'Washington Examiner', 'National Review', 'New York Post', 'The Blaze', 'Newsmax'
    ]
  }
};

// Known exceptions to the rules
const exceptions = {
  stateExceptions: ['BBC', 'BBC News'], // BBC is technically public but editorially independent
  corporateExceptions: [], // Any corporate exceptions
  biasExceptions: [] // Any bias exceptions
};

async function validateSourceCategorization() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database successfully!');
    
    const Source = mongoose.model('Source');
    
    console.log('Fetching all sources from database...');
    const sources = await Source.find();
    console.log(`Fetched ${sources.length} sources from database.`);
    
    // Container for validation issues
    const potentialIssues = {
      stateMediaIssues: [],
      corporateMediaIssues: [],
      biasIssues: [],
      duplicateNameIssues: [],
      sameCategoryBiasIssues: []
    };
    
    // Track names for duplicate detection
    const nameMap = {};
    
    // Statistics
    const stats = {
      total: sources.length,
      byType: {},
      byCategory: {},
      byBias: {}
    };
    
    // Process each source and check for potential issues
    sources.forEach(source => {
      // Track statistics
      stats.byType[source.type] = (stats.byType[source.type] || 0) + 1;
      stats.byCategory[source.category] = (stats.byCategory[source.category] || 0) + 1;
      stats.byBias[source.bias] = (stats.byBias[source.bias] || 0) + 1;
      
      // Check for duplicate names
      if (!nameMap[source.name]) {
        nameMap[source.name] = [];
      }
      nameMap[source.name].push(source);
      
      // Check for STATE media patterns
      if (source.type !== 'STATE' && 
          !exceptions.stateExceptions.includes(source.name) &&
          validationRules.stateMediaPatterns.some(pattern => 
            source.name.toLowerCase().includes(pattern.toLowerCase()))) {
        potentialIssues.stateMediaIssues.push({
          id: source._id,
          name: source.name,
          url: source.url,
          currentType: source.type,
          suggestedType: 'STATE',
          category: source.category,
          bias: source.bias
        });
      }
      
      // Check for CORPORATE media patterns
      if (source.type !== 'CORPORATE' && 
          !exceptions.corporateExceptions.includes(source.name) &&
          validationRules.corporateMediaPatterns.some(pattern => 
            source.name.toLowerCase().includes(pattern.toLowerCase()))) {
        potentialIssues.corporateMediaIssues.push({
          id: source._id,
          name: source.name,
          url: source.url,
          currentType: source.type,
          suggestedType: 'CORPORATE',
          category: source.category,
          bias: source.bias
        });
      }
      
      // Check for bias patterns
      if (source.bias === 'CENTRIST' && 
          validationRules.expectedBiasPatterns.liberalSources.some(pattern => 
            source.name.toLowerCase().includes(pattern.toLowerCase()))) {
        potentialIssues.biasIssues.push({
          id: source._id,
          name: source.name,
          url: source.url,
          currentBias: source.bias,
          suggestedBias: 'LIBERAL',
          category: source.category,
          type: source.type
        });
      }
      
      if (source.bias === 'CENTRIST' && 
          validationRules.expectedBiasPatterns.conservativeSources.some(pattern => 
            source.name.toLowerCase().includes(pattern.toLowerCase()))) {
        potentialIssues.biasIssues.push({
          id: source._id,
          name: source.name,
          url: source.url,
          currentBias: source.bias,
          suggestedBias: 'CONSERVATIVE',
          category: source.category,
          type: source.type
        });
      }
    });
    
    // Check for duplicate names
    Object.entries(nameMap).forEach(([name, sources]) => {
      if (sources.length > 1) {
        potentialIssues.duplicateNameIssues.push({
          name,
          count: sources.length,
          sources: sources.map(s => ({
            id: s._id,
            url: s.url,
            category: s.category,
            bias: s.bias,
            type: s.type
          }))
        });
      }
    });
    
    // Find patterns of same category, same bias sources
    const categoryBiasMap = {};
    sources.forEach(source => {
      const key = `${source.category}-${source.bias}`;
      if (!categoryBiasMap[key]) {
        categoryBiasMap[key] = [];
      }
      categoryBiasMap[key].push(source);
    });
    
    // Identify categories with highly skewed bias distributions
    Object.entries(categoryBiasMap).forEach(([key, sourcesInGroup]) => {
      const [category, bias] = key.split('-');
      if (sourcesInGroup.length >= 5) { // Only consider groups with at least 5 sources
        potentialIssues.sameCategoryBiasIssues.push({
          category,
          bias,
          count: sourcesInGroup.length,
          sources: sourcesInGroup.map(s => ({
            id: s._id,
            name: s.name,
            url: s.url,
            type: s.type
          }))
        });
      }
    });
    
    // Generate report
    console.log('\n=== SOURCE CATEGORIZATION VALIDATION REPORT ===\n');
    
    console.log('STATISTICS:\n');
    console.log(`Total sources: ${stats.total}`);
    
    console.log('\nBy Type:');
    Object.entries(stats.byType).sort().forEach(([type, count]) => {
      console.log(`  ${type}: ${count} (${(count / stats.total * 100).toFixed(1)}%)`);
    });
    
    console.log('\nBy Category:');
    Object.entries(stats.byCategory).sort().forEach(([category, count]) => {
      console.log(`  ${category}: ${count} (${(count / stats.total * 100).toFixed(1)}%)`);
    });
    
    console.log('\nBy Bias:');
    Object.entries(stats.byBias).sort().forEach(([bias, count]) => {
      console.log(`  ${bias}: ${count} (${(count / stats.total * 100).toFixed(1)}%)`);
    });
    
    console.log('\nPOTENTIAL ISSUES:\n');
    
    console.log('1. Sources that might be misclassified as STATE media:');
    if (potentialIssues.stateMediaIssues.length > 0) {
      potentialIssues.stateMediaIssues.forEach(issue => {
        console.log(`  - ${issue.name} (Current: ${issue.currentType}, Suggested: STATE)`);
      });
    } else {
      console.log('  No issues found.');
    }
    
    console.log('\n2. Sources that might be misclassified as CORPORATE media:');
    if (potentialIssues.corporateMediaIssues.length > 0) {
      potentialIssues.corporateMediaIssues.forEach(issue => {
        console.log(`  - ${issue.name} (Current: ${issue.currentType}, Suggested: CORPORATE)`);
      });
    } else {
      console.log('  No issues found.');
    }
    
    console.log('\n3. Sources with potential bias misclassification:');
    if (potentialIssues.biasIssues.length > 0) {
      potentialIssues.biasIssues.forEach(issue => {
        console.log(`  - ${issue.name} (Current: ${issue.currentBias}, Suggested: ${issue.suggestedBias})`);
      });
    } else {
      console.log('  No issues found.');
    }
    
    console.log('\n4. Sources with duplicate names:');
    if (potentialIssues.duplicateNameIssues.length > 0) {
      potentialIssues.duplicateNameIssues.forEach(issue => {
        console.log(`  - "${issue.name}" appears ${issue.count} times:`);
        issue.sources.forEach(s => {
          console.log(`    * ${s.url} (Category: ${s.category}, Bias: ${s.bias}, Type: ${s.type})`);
        });
      });
    } else {
      console.log('  No duplicate names found.');
    }
    
    console.log('\n5. Categories with many sources sharing the same bias:');
    if (potentialIssues.sameCategoryBiasIssues.length > 0) {
      potentialIssues.sameCategoryBiasIssues.forEach(issue => {
        console.log(`  - ${issue.category} has ${issue.count} sources with ${issue.bias} bias`);
      });
    } else {
      console.log('  No significant bias clustering found.');
    }
    
    // Write detailed report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      statistics: stats,
      potentialIssues
    };
    
    const reportPath = path.join(__dirname, '../source_validation_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\nDetailed validation report written to: ${reportPath}`);
    
    // Close the database connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the function
validateSourceCategorization(); 