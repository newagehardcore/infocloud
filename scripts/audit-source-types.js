const fs = require('fs');
const path = require('path');

// Load the sources from the sources_import.json file
const sourcesFilePath = path.join(__dirname, '../../sources_import.json');
const sources = JSON.parse(fs.readFileSync(sourcesFilePath, 'utf8'));

console.log(`Total sources found: ${sources.length}`);

// Define media organizations by type
const mediaTypeMap = {
  // Major corporate media organizations
  CORPORATE: [
    // Major news networks and publishers
    'ABC News', 'CBS News', 'NBC News', 'FOX News', 'CNN', 'MSNBC', 'BBC News', 'Reuters', 
    'Associated Press', 'USA Today', 'Wall Street Journal', 'Washington Post', 'New York Times', 
    'NYT', 'Bloomberg', 'CNBC', 'Financial Times', 'WSJ', 'Fox News', 'Time', 'Fortune', 'Forbes',
    'Business Insider', 'MarketWatch', 'The Atlantic', 'The Economist', 'Newsweek', 'U.S. News',
    'LA Times', 'Chicago Tribune', 'Boston Globe', 'The Guardian', 'Politico', 'Vox', 'The Hill',
    'The New Yorker', 'Vanity Fair', 'Rolling Stone', 'ESPN', 'Sports Illustrated', 'Sky News',
    'TMZ', 'Variety', 'The Hollywood Reporter', 'Deadline', 'Billboard', 'WIRED', 'CNET News', 
    'The Verge', 'TechCrunch', 'Engadget', 'Gizmodo', 'National Geographic', 'Scientific American',
    'Popular Science', 'Popular Mechanics', 'Vice', 'Huffington Post', 'HuffPost', 'BuzzFeed',
    'The Daily Beast', 'Axios', 'Insider', 'The New Republic', 'Slate', 'Protocol', 'Android Central', 
    '9to5Mac', 'MacRumors', 'Android Police', 'Investopedia', 'Yahoo', 'Vogue', 'Harper\'s Bazaar', 
    'GQ', 'Elle', 'WWD', 'The Ringer', 'Bleacher Report', 'The Athletic', 'CBS Sports'
  ],
  
  // Independent media organizations
  INDEPENDENT: [
    'Reason', 'Breitbart', 'The Intercept', 'The American Conservative', 'The Nation', 
    'Mother Jones', 'National Review', 'Washington Examiner', 'Daily Caller', 'Daily Wire',
    'The Federalist', 'Common Dreams', 'Current Affairs', 'Jacobin', 'The Bulwark',
    'RealClearPolitics', 'Washington Times', 'The Diplomat', 'The Epoch Times', 'The Spectator',
    'Asia Times', 'The National Interest', 'Governing', 'American Prospect', 'Townhall',
    'Daily Kos', 'Quillette', 'Techdirt', 'Legal Insurrection', 'Zero Hedge', 'Mises Institute',
    'Economic Policy Institute', 'Grist', 'Treehugger', 'Climate Depot', 'Watts Up With That',
    'JoNova', 'Yale Environment 360', 'Earth First Journal', 'EcoWatch', 'CO2 Coalition',
    'The Green Market', 'The Breakthrough Institute', 'Carbon Brief', 'Pitchfork', 'NME', 
    'Consequence of Sound', 'Stereogum', 'Ultimate Classic Rock', 'The Boot', 'Saving Country Music', 
    'Metal Injection', 'Tiny Mix Tapes', 'SCOTUSblog', 'Lawfare', 'FindLaw', 'ABA Journal', 
    'Casetext', 'Balkinization', 'Truth on the Market', 'Singularity Hub', 'Machine Learning Mastery', 
    'Towards Data Science', 'Skynet Today', 'Mind Matters', 'Future of Life Institute', 'AI Watch', 
    'The Gradient', 'AI Alignment Forum', 'Less Wrong', 'Universe Today', 'Behind the Black', 
    'SpacePolicyOnline', 'The Space Review', 'Orbital Mechanics', 'The Fashion Law', 
    'The Business of Fashion', 'Fashionista', 'Highsnobiety', 'Hypebeast', 'The Modest Mom', 
    'WhoWhatWear', 'Man Repeller', 'Fashion Gone Rogue', 'Dressed Modestly', 'Fashion Journal', 
    'Fashion United', 'The Fashion Spot', 'Artnet', 'Hyperallergic', 'ARTnews', 'ArtForum', 
    'The Art Newspaper', 'Art in America', 'Observer Arts', 'Catholic Art Guild', 'Artsy', 
    'Art & Object', 'New Criterion', 'Traditional Building', 'Beautiful Art', 'American Renaissance', 
    'Public Art Review', 'Aesthetica Magazine'
  ],
  
  // State-funded media organizations
  STATE: [
    'Russia Today', 'C-SPAN', 'France 24', 'Deutsche Welle', 'Democracy Now', 'Al Jazeera',
    'PBS', 'NPR', 'BBC', 'VOA', 'CGTN', 'RT', 'CBC', 'ABC Australia', 'NHK', 'NASA', 'ESA',
    'WHO News', 'UN News', 'World Bank', 'IMF', 'Kyodo News', 'AFP', 'Xinhua', 'TASS',
    'Sputnik', 'Yonhap', 'TRT World', 'The Japan Times', 'Straits Times', 'Press TV'
  ]
};

// Helper function to determine media type
function determineMediaType(sourceName) {
  // First check for exact matches in our lists
  for (const [type, sourceList] of Object.entries(mediaTypeMap)) {
    if (sourceList.some(name => 
      sourceName === name || 
      sourceName.includes(`${name} -`) || 
      sourceName.includes(`${name} –`))) {
      return type;
    }
  }
  
  // For remaining sources, try to categorize based on partial name matches
  for (const [type, sourceList] of Object.entries(mediaTypeMap)) {
    for (const name of sourceList) {
      if (sourceName.includes(name)) {
        return type;
      }
    }
  }
  
  // Manual categorization for some special cases
  if (sourceName.includes('University') || 
      sourceName.includes('Institute') || 
      sourceName.includes('Foundation') ||
      sourceName.includes('Society') ||
      sourceName.includes('Journal') ||
      sourceName.includes('Academy') ||
      sourceName.includes('College') ||
      sourceName.includes('School')) {
    return 'INDEPENDENT';
  }
  
  // Check for government agencies
  if (sourceName.includes('Government') || 
      sourceName.includes('Ministry') || 
      sourceName.includes('Department') ||
      sourceName.includes('Agency') ||
      sourceName.includes('Council')) {
    return 'STATE';
  }
  
  // Default to INDEPENDENT if no match is found
  return 'INDEPENDENT';
}

// Process each source and add the media type
const sourceTypes = {};
const sourcesWithType = sources.map(source => {
  const mediaType = determineMediaType(source.name);
  
  // Track source types for reporting
  if (!sourceTypes[mediaType]) {
    sourceTypes[mediaType] = 0;
  }
  sourceTypes[mediaType]++;
  
  return {
    ...source,
    type: mediaType
  };
});

// Output summary statistics
console.log('\nMedia Type Distribution:');
Object.entries(sourceTypes).forEach(([type, count]) => {
  console.log(`${type}: ${count} (${(count / sources.length * 100).toFixed(1)}%)`);
});

// Write the updated sources to a new file
const outputPath = path.join(__dirname, '../sources_with_type.json');
fs.writeFileSync(outputPath, JSON.stringify(sourcesWithType, null, 2));

console.log(`\nUpdated sources with media types written to: ${outputPath}`);

// Create a more detailed audit report for review
const categoriesMap = {};
const biasMap = {};

sourcesWithType.forEach(source => {
  // Count by category
  if (!categoriesMap[source.category]) {
    categoriesMap[source.category] = { total: 0 };
  }
  categoriesMap[source.category].total++;
  
  // Count by bias
  if (!biasMap[source.bias]) {
    biasMap[source.bias] = { total: 0 };
  }
  biasMap[source.bias].total++;
  
  // Count by category and type
  const typeKey = `${source.type}`;
  if (!categoriesMap[source.category][typeKey]) {
    categoriesMap[source.category][typeKey] = 0;
  }
  categoriesMap[source.category][typeKey]++;
  
  // Count by bias and type
  if (!biasMap[source.bias][typeKey]) {
    biasMap[source.bias][typeKey] = 0;
  }
  biasMap[source.bias][typeKey]++;
});

// Print category statistics
console.log('\nCategory Distribution:');
Object.entries(categoriesMap).sort((a, b) => b[1].total - a[1].total).forEach(([category, counts]) => {
  console.log(`${category}: ${counts.total} total`);
  Object.entries(counts).forEach(([key, count]) => {
    if (key !== 'total') {
      console.log(`  - ${key}: ${count} (${(count / counts.total * 100).toFixed(1)}%)`);
    }
  });
});

// Print bias statistics
console.log('\nBias Distribution:');
Object.entries(biasMap).sort((a, b) => b[1].total - a[1].total).forEach(([bias, counts]) => {
  console.log(`${bias}: ${counts.total} total`);
  Object.entries(counts).forEach(([key, count]) => {
    if (key !== 'total') {
      console.log(`  - ${key}: ${count} (${(count / counts.total * 100).toFixed(1)}%)`);
    }
  });
});

// Generate a CSV file for easy spreadsheet import/review
const csvHeaders = 'Name,Category,Bias,Type,URL\n';
const csvRows = sourcesWithType.map(s => 
  `"${s.name}","${s.category}","${s.bias}","${s.type}","${s.url}"`
).join('\n');

const csvPath = path.join(__dirname, '../sources_audit.csv');
fs.writeFileSync(csvPath, csvHeaders + csvRows);

console.log(`\nDetailed CSV audit report written to: ${csvPath}`); 