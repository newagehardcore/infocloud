/**
 * Script to automatically assign source types to all sources in the database
 * 
 * This script will:
 * 1. Fetch all sources from the database
 * 2. Classify each source as INDEPENDENT, CORPORATE, STATE, or UNKNOWN
 * 3. Update each source with the appropriate type
 * 4. Propagate the changes to all news items associated with these sources
 * 
 * Run with: node src/scripts/assign-source-types.js
 */

const mongoose = require('mongoose');
const { SOURCE_TYPES } = require('../utils/constants');
const { getAllSources, updateSource } = require('../services/sourceManagementService');
const { connectDB } = require('../config/db');

// Database of source classifications
const sourceTypeDatabase = {
  // Major corporate media
  corporate: [
    'cnn', 'nbc', 'abc', 'cbs', 'fox', 'msnbc', 'new york times', 'nyt', 'washington post',
    'wsj', 'wall street journal', 'usa today', 'time magazine', 'bloomberg', 'fortune',
    'forbes', 'business insider', 'huffpost', 'huffington', 'yahoo', 'vox', 'vice', 'buzzfeed',
    'gizmodo', 'wired', 'techcrunch', 'venturebeat', 'zdnet', 'variety', 'tmz', 'warner',
    'espn', 'disney', 'comcast', 'nbcuniversal', 'paramount', 'viacom', 'news corp',
    'daily wire', 'axios', 'atlantic', 'economist', 'financial times', 'marketwatch',
    'cnet', 'insider', 'bustle', 'la times', 'los angeles times', 'newsweek', 'new york post',
    'ny post', 'quartz', 'slate', 'univision', 'hollywood reporter', 'verge', 'vox', 'axios',
    'guardian', 'telegraph', 'mail', 'dailymail', 'sky news', 'times of india', 'investopedia',
    'medscape', 'dotdash', 'g/o media', 'rolling stone', 'pitchfork', 'allure'
  ],
  
  // State-controlled or state-influenced media
  state: [
    'bbc', 'npr', 'pbs', 'voa', 'voice of america', 'russia today', 'rt', 'sputnik', 
    'al jazeera', 'xinhua', 'cgtn', 'tass', 'ria novosti', 'nhk', 'france 24', 'deutsche welle', 
    'dw', 'abc australia', 'cbc', 'ard', 'zdf', 'rte', 'svt', 'yle', 'nrk', 'who', 'un news',
    'nasa', 'esa', 'people\'s daily', 'global times', 'cctv', 'press tv'
  ],
  
  // Independent media (by exclusion or specific identification)
  independent: [
    'substack', 'medium', 'propublica', 'intercept', 'jacobin', 'democracy now', 'reason',
    'national review', 'new republic', 'nation', 'american conservative', 'american prospect',
    'mother jones', 'counterpunch', 'truthout', 'common dreams', 'fair', 'grist', 'arctic review',
    'current affairs', 'progressive', 'alternet', 'consortium news', 'gray zone', 'truthdig',
    'palladium', 'quillette', 'aeon', 'unherd', 'spectator', 'new atlantis', 'tablet magazine',
    'commentary', 'federalist', 'american mind', 'bulwark', 'dispatch', 'persuasion', 'jezebel',
    'fifth column', 'nonzero', 'secular talk', 'breaking points', 'majority report', 'tyt',
    'young turks', 'hill rising', 'krystal kyle', 'useful idiots', 'realignment', 'chapo',
    'red scare', 'national interest', 'foreign policy', 'foreign affairs', 'diplomat', 'lawfare',
    'war on the rocks', 'responsible statecraft', 'inkstick', 'naked capitalism', 'marginal revolution',
    'econlog', 'conversable economist', 'crooked timber', 'monkey cage', 'lawyers guns money'
  ]
};

// Function to determine source type based on name and URL
function determineSourceType(source) {
  const name = source.name.toLowerCase();
  const url = source.url.toLowerCase();
  
  // Check for state media first
  for (const term of sourceTypeDatabase.state) {
    if (name.includes(term) || url.includes(term)) {
      return SOURCE_TYPES[2]; // STATE
    }
  }
  
  // Check for corporate media
  for (const term of sourceTypeDatabase.corporate) {
    if (name.includes(term) || url.includes(term)) {
      return SOURCE_TYPES[1]; // CORPORATE
    }
  }
  
  // Check for independent media
  for (const term of sourceTypeDatabase.independent) {
    if (name.includes(term) || url.includes(term)) {
      return SOURCE_TYPES[0]; // INDEPENDENT
    }
  }
  
  // Custom logic for specific domains
  if (url.includes('.org/') || url.includes('.org"')) {
    return SOURCE_TYPES[0]; // Most .org sites are INDEPENDENT
  }
  
  if (url.includes('.gov/') || url.includes('.gov"')) {
    return SOURCE_TYPES[2]; // Government sites are STATE
  }
  
  // Specific source handling
  // New York Times
  if (name.includes('nyt') || name.includes('new york times') || url.includes('nytimes.com')) {
    return SOURCE_TYPES[1]; // CORPORATE
  }
  
  // National media brands are usually corporate
  if (name.startsWith('the ') && name.length > 5) {
    return SOURCE_TYPES[1]; // Most "The X" are corporate publications
  }
  
  // Academic and research institutions are typically independent
  if (url.includes('.edu/') || url.includes('university') || name.includes('university') || name.includes('institute')) {
    return SOURCE_TYPES[0]; // INDEPENDENT
  }
  
  // Default to UNKNOWN if we can't determine
  return SOURCE_TYPES[3]; // UNKNOWN
}

// Additional specific source mappings based on the sources in your database
const specificSourceMappings = {
  // General major news outlets
  'npr': SOURCE_TYPES[2], // STATE (publicly funded)
  'bbc': SOURCE_TYPES[2], // STATE (publicly funded)
  'reuters': SOURCE_TYPES[1], // CORPORATE
  'associated press': SOURCE_TYPES[1], // CORPORATE
  'ap': SOURCE_TYPES[1], // CORPORATE
  'afp': SOURCE_TYPES[1], // CORPORATE
  'cnn': SOURCE_TYPES[1], // CORPORATE
  'fox news': SOURCE_TYPES[1], // CORPORATE
  'msnbc': SOURCE_TYPES[1], // CORPORATE
  'breitbart': SOURCE_TYPES[1], // CORPORATE
  'huffington post': SOURCE_TYPES[1], // CORPORATE
  'huffpost': SOURCE_TYPES[1], // CORPORATE
  'washington post': SOURCE_TYPES[1], // CORPORATE
  'new york times': SOURCE_TYPES[1], // CORPORATE
  'wall street journal': SOURCE_TYPES[1], // CORPORATE
  'wsj': SOURCE_TYPES[1], // CORPORATE
  'guardian': SOURCE_TYPES[1], // CORPORATE
  'daily mail': SOURCE_TYPES[1], // CORPORATE
  'russia today': SOURCE_TYPES[2], // STATE
  'rt': SOURCE_TYPES[2], // STATE
  'al jazeera': SOURCE_TYPES[2], // STATE
  'democracy now': SOURCE_TYPES[0], // INDEPENDENT
  'intercept': SOURCE_TYPES[0], // INDEPENDENT
  'propublica': SOURCE_TYPES[0], // INDEPENDENT
  'vox': SOURCE_TYPES[1], // CORPORATE
  'axios': SOURCE_TYPES[1], // CORPORATE
  'mother jones': SOURCE_TYPES[0], // INDEPENDENT
  
  // Based on specific sources in your database
  'daily wire': SOURCE_TYPES[1], // CORPORATE
  'deadline': SOURCE_TYPES[1], // CORPORATE
  'deadspin': SOURCE_TYPES[1], // CORPORATE
  'deepmind blog': SOURCE_TYPES[1], // CORPORATE (owned by Google)
  'democracy now': SOURCE_TYPES[0], // INDEPENDENT
  'deutsche welle': SOURCE_TYPES[2], // STATE (German public broadcaster)
  'discovery institute': SOURCE_TYPES[0], // INDEPENDENT
  'distill': SOURCE_TYPES[0], // INDEPENDENT (academic publication)
  'e&e news': SOURCE_TYPES[1], // CORPORATE
  'esa': SOURCE_TYPES[2], // STATE (European Space Agency)
  'espn': SOURCE_TYPES[1], // CORPORATE (owned by Disney)
  'economic policy institute': SOURCE_TYPES[0], // INDEPENDENT
  'fashion gone rogue': SOURCE_TYPES[1], // CORPORATE
  'fashion journal': SOURCE_TYPES[1], // CORPORATE
  'financial times': SOURCE_TYPES[1], // CORPORATE
  'fivethirtyeight': SOURCE_TYPES[1], // CORPORATE (owned by ABC/Disney)
  'forbes': SOURCE_TYPES[1], // CORPORATE
  'foreign policy': SOURCE_TYPES[1], // CORPORATE
  'fortune': SOURCE_TYPES[1], // CORPORATE
  'fox news': SOURCE_TYPES[1], // CORPORATE
  'fox sports': SOURCE_TYPES[1], // CORPORATE
  'france 24': SOURCE_TYPES[2], // STATE (French public broadcaster)
  'free republic': SOURCE_TYPES[0], // INDEPENDENT
  'future of life institute': SOURCE_TYPES[0], // INDEPENDENT
  'gq': SOURCE_TYPES[1], // CORPORATE (Condé Nast)
  'gizmodo': SOURCE_TYPES[1], // CORPORATE
  'green car reports': SOURCE_TYPES[1], // CORPORATE
  'grist': SOURCE_TYPES[0], // INDEPENDENT
  'hacker news': SOURCE_TYPES[0], // INDEPENDENT
  'health affairs': SOURCE_TYPES[0], // INDEPENDENT
  'healthline': SOURCE_TYPES[1], // CORPORATE
  'highsnobiety': SOURCE_TYPES[1], // CORPORATE
  'hot air': SOURCE_TYPES[1], // CORPORATE
  'huffpost': SOURCE_TYPES[1], // CORPORATE
  'hugging face': SOURCE_TYPES[1], // CORPORATE
  'hypebeast': SOURCE_TYPES[1], // CORPORATE
  'hyperallergic': SOURCE_TYPES[0], // INDEPENDENT
  'ieee spectrum': SOURCE_TYPES[0], // INDEPENDENT
  'inside climate news': SOURCE_TYPES[0], // INDEPENDENT
  'investopedia': SOURCE_TYPES[1], // CORPORATE
  'jacobin': SOURCE_TYPES[0], // INDEPENDENT
  'japan times': SOURCE_TYPES[1], // CORPORATE
  'jerusalem post': SOURCE_TYPES[1], // CORPORATE
  'jonova': SOURCE_TYPES[0], // INDEPENDENT
  'jurist': SOURCE_TYPES[0], // INDEPENDENT
  'justia': SOURCE_TYPES[1], // CORPORATE
  'kaiser health news': SOURCE_TYPES[0], // INDEPENDENT
  'knowledge@wharton': SOURCE_TYPES[0], // INDEPENDENT
  'la times': SOURCE_TYPES[1], // CORPORATE
  'law & crime': SOURCE_TYPES[1], // CORPORATE
  'legal insurrection': SOURCE_TYPES[0], // INDEPENDENT
  'less wrong': SOURCE_TYPES[0], // INDEPENDENT
  'live science': SOURCE_TYPES[1], // CORPORATE
  'mit technology review': SOURCE_TYPES[0], // INDEPENDENT
  'machine learning mastery': SOURCE_TYPES[0], // INDEPENDENT
  'marketwatch': SOURCE_TYPES[1], // CORPORATE
  'master resource': SOURCE_TYPES[0], // INDEPENDENT
  'medpage today': SOURCE_TYPES[1], // CORPORATE
  'medscape': SOURCE_TYPES[1], // CORPORATE
  'metal injection': SOURCE_TYPES[0], // INDEPENDENT
  'mind matters': SOURCE_TYPES[0], // INDEPENDENT
  'mises institute': SOURCE_TYPES[0], // INDEPENDENT
  'mother jones': SOURCE_TYPES[0], // INDEPENDENT
  'movieguide': SOURCE_TYPES[0], // INDEPENDENT
  'movieweb': SOURCE_TYPES[1], // CORPORATE
  'nasa': SOURCE_TYPES[2], // STATE
  'nasaspaceflight': SOURCE_TYPES[0], // INDEPENDENT
  'nbc news': SOURCE_TYPES[1], // CORPORATE
  'nme': SOURCE_TYPES[1], // CORPORATE
  'national review': SOURCE_TYPES[0], // INDEPENDENT
  'natural news': SOURCE_TYPES[0], // INDEPENDENT
  'nature': SOURCE_TYPES[1], // CORPORATE
  'new criterion': SOURCE_TYPES[0], // INDEPENDENT
  'new england journal of medicine': SOURCE_TYPES[0], // INDEPENDENT
  'new scientist': SOURCE_TYPES[1], // CORPORATE
  'new york post': SOURCE_TYPES[1], // CORPORATE
  'newsweek': SOURCE_TYPES[1], // CORPORATE
  'observer': SOURCE_TYPES[1], // CORPORATE
  'outkick': SOURCE_TYPES[1], // CORPORATE (FOX)
  'pacific legal foundation': SOURCE_TYPES[0], // INDEPENDENT
  'pitchfork': SOURCE_TYPES[1], // CORPORATE (Condé Nast)
  'plugged in': SOURCE_TYPES[0], // INDEPENDENT
  'popculture.com': SOURCE_TYPES[1], // CORPORATE
  'popular mechanics': SOURCE_TYPES[1], // CORPORATE
  'popular science': SOURCE_TYPES[1], // CORPORATE
  'project syndicate': SOURCE_TYPES[0], // INDEPENDENT
  'public art review': SOURCE_TYPES[0], // INDEPENDENT
  'quanta magazine': SOURCE_TYPES[0], // INDEPENDENT
  'real climate': SOURCE_TYPES[0], // INDEPENDENT
  'realclearpolitics': SOURCE_TYPES[1], // CORPORATE
  'reason': SOURCE_TYPES[0], // INDEPENDENT
  'recode': SOURCE_TYPES[1], // CORPORATE (Vox Media)
  'rolling stone': SOURCE_TYPES[1], // CORPORATE
  'russia today': SOURCE_TYPES[2], // STATE
  'sb nation': SOURCE_TYPES[1], // CORPORATE (Vox Media)
  'scotusblog': SOURCE_TYPES[0], // INDEPENDENT
  'stat news': SOURCE_TYPES[1], // CORPORATE
  'saving country music': SOURCE_TYPES[0], // INDEPENDENT
  'science 2.0': SOURCE_TYPES[0], // INDEPENDENT
  'science based medicine': SOURCE_TYPES[0], // INDEPENDENT
  'science magazine': SOURCE_TYPES[0], // INDEPENDENT
  'science news': SOURCE_TYPES[0], // INDEPENDENT
  'sciencedaily': SOURCE_TYPES[0], // INDEPENDENT
  'scientific american': SOURCE_TYPES[1], // CORPORATE
  'screen rant': SOURCE_TYPES[1], // CORPORATE
  'seeking alpha': SOURCE_TYPES[1], // CORPORATE
  'singularity hub': SOURCE_TYPES[0], // INDEPENDENT
  'sky news': SOURCE_TYPES[1], // CORPORATE
  'slashdot': SOURCE_TYPES[1], // CORPORATE
  'slate': SOURCE_TYPES[1], // CORPORATE
  'smithsonian magazine': SOURCE_TYPES[2], // STATE (Smithsonian is government-funded)
  'space intel report': SOURCE_TYPES[0], // INDEPENDENT
  'space.com': SOURCE_TYPES[1], // CORPORATE
  'spacenews': SOURCE_TYPES[1], // CORPORATE
  'spacepolicyonline': SOURCE_TYPES[0], // INDEPENDENT
  'spaceref': SOURCE_TYPES[0], // INDEPENDENT
  'sporting news': SOURCE_TYPES[1], // CORPORATE
  'stereogum': SOURCE_TYPES[1], // CORPORATE
  'tmz': SOURCE_TYPES[1], // CORPORATE
  'techcrunch': SOURCE_TYPES[1], // CORPORATE
  'techdirt': SOURCE_TYPES[0], // INDEPENDENT
  'techmeme': SOURCE_TYPES[0], // INDEPENDENT
  'the a.v. club': SOURCE_TYPES[1], // CORPORATE
  'the american conservative': SOURCE_TYPES[0], // INDEPENDENT
  'the atlantic': SOURCE_TYPES[1], // CORPORATE
  'the blaze': SOURCE_TYPES[1], // CORPORATE
  'the boot': SOURCE_TYPES[1], // CORPORATE
  'the bulwark': SOURCE_TYPES[0], // INDEPENDENT
  'the business of fashion': SOURCE_TYPES[1], // CORPORATE
  'the diplomat': SOURCE_TYPES[0], // INDEPENDENT
  'the economist': SOURCE_TYPES[1], // CORPORATE
  'the fashion spot': SOURCE_TYPES[1], // CORPORATE
  'the federalist': SOURCE_TYPES[0], // INDEPENDENT
  'the gradient': SOURCE_TYPES[0], // INDEPENDENT
  'the green market': SOURCE_TYPES[0], // INDEPENDENT
  'the guardian': SOURCE_TYPES[1], // CORPORATE
  'the healthy skeptic': SOURCE_TYPES[0], // INDEPENDENT
  'the hill': SOURCE_TYPES[1], // CORPORATE
  'the hollywood reporter': SOURCE_TYPES[1], // CORPORATE
  'the intercept': SOURCE_TYPES[0], // INDEPENDENT
  'the nation': SOURCE_TYPES[0], // INDEPENDENT
  'the national interest': SOURCE_TYPES[0], // INDEPENDENT
  'the register': SOURCE_TYPES[1], // CORPORATE
  'the spectator': SOURCE_TYPES[1], // CORPORATE
  'the verge': SOURCE_TYPES[1], // CORPORATE (Vox Media)
  'the vinyl factory': SOURCE_TYPES[0], // INDEPENDENT
  'the volokh conspiracy': SOURCE_TYPES[0], // INDEPENDENT
  'times of india': SOURCE_TYPES[1], // CORPORATE
  'towards data science': SOURCE_TYPES[0], // INDEPENDENT
  'traditional building': SOURCE_TYPES[1], // CORPORATE
  'truth on the market': SOURCE_TYPES[0], // INDEPENDENT
  'un news': SOURCE_TYPES[2], // STATE
  'ultimate classic rock': SOURCE_TYPES[1], // CORPORATE
  'undark magazine': SOURCE_TYPES[0], // INDEPENDENT
  'universe today': SOURCE_TYPES[0], // INDEPENDENT
  'variety': SOURCE_TYPES[1], // CORPORATE
  'venturebeat': SOURCE_TYPES[1], // CORPORATE
  'vox': SOURCE_TYPES[1], // CORPORATE
  'who news': SOURCE_TYPES[2], // STATE
  'wired': SOURCE_TYPES[1], // CORPORATE (Condé Nast)
  'wwd': SOURCE_TYPES[1], // CORPORATE
  'washington examiner': SOURCE_TYPES[1], // CORPORATE
  'washington legal foundation': SOURCE_TYPES[0], // INDEPENDENT
  'washington post': SOURCE_TYPES[1], // CORPORATE
  'washington times': SOURCE_TYPES[1], // CORPORATE
  'watts up with that': SOURCE_TYPES[0], // INDEPENDENT
  'whowhatwear': SOURCE_TYPES[1], // CORPORATE
  'xxl magazine': SOURCE_TYPES[1], // CORPORATE
  'yahoo finance': SOURCE_TYPES[1], // CORPORATE
  'yahoo sports': SOURCE_TYPES[1], // CORPORATE
  'yale environment 360': SOURCE_TYPES[0], // INDEPENDENT
  'zdnet': SOURCE_TYPES[1], // CORPORATE
  'zero hedge': SOURCE_TYPES[0], // INDEPENDENT
};

async function assignSourceTypes() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database successfully!');
    
    console.log('Fetching all sources...');
    const sources = await getAllSources();
    console.log(`Fetched ${sources.length} sources.`);
    
    const updates = [];
    const typeCounts = {
      INDEPENDENT: 0,
      CORPORATE: 0,
      STATE: 0,
      UNKNOWN: 0
    };
    
    for (const source of sources) {
      // Skip sources that already have a type
      if (source.type && source.type !== 'UNKNOWN') {
        console.log(`Source ${source.name} already has type ${source.type}. Skipping.`);
        typeCounts[source.type]++;
        continue;
      }
      
      // Check for specific mapping first
      let sourceType = null;
      const sourceLower = source.name.toLowerCase();
      
      for (const [key, value] of Object.entries(specificSourceMappings)) {
        if (sourceLower.includes(key)) {
          sourceType = value;
          break;
        }
      }
      
      // If no specific mapping, determine type
      if (!sourceType) {
        sourceType = determineSourceType(source);
      }
      
      console.log(`Assigning source ${source.name} -> ${sourceType}`);
      typeCounts[sourceType]++;
      
      // Update the source
      updates.push(updateSource(source.id, { type: sourceType }));
    }
    
    console.log('Updating sources...');
    await Promise.all(updates);
    
    console.log('Source type assignment complete!');
    console.log('Summary:');
    console.log(`INDEPENDENT: ${typeCounts.INDEPENDENT}`);
    console.log(`CORPORATE: ${typeCounts.CORPORATE}`);
    console.log(`STATE: ${typeCounts.STATE}`);
    console.log(`UNKNOWN: ${typeCounts.UNKNOWN}`);
    
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the function
assignSourceTypes(); 