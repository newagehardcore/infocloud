// news-backend/src/types/index.js

// Define constants for PoliticalBias (matching frontend types)
const PoliticalBias = {
  Left: 'Left',
  Liberal: 'Liberal',
  Centrist: 'Centrist',
  Unknown: 'Unknown',
  Conservative: 'Conservative',
  Right: 'Right'
};

// Define constants for NewsCategory
const NewsCategory = {
    POLITICS: 'POLITICS',
    NEWS: 'NEWS',
    SCIENCE: 'SCIENCE',
    TECH: 'TECH',
    BUSINESS: 'BUSINESS', // Added based on potential needs
    SPORTS: 'SPORTS',     // Added based on potential needs
    WORLD: 'WORLD',       // Added based on potential needs
    ENTERTAINMENT: 'ENTERTAINMENT', // Added from admin panel observation
    ENVIRONMENT: 'ENVIRONMENT',   // Added from admin panel observation
    HEALTH: 'HEALTH',           // Added from admin panel observation
    US: 'US',                 // Added from admin panel observation
    UNKNOWN: 'UNKNOWN'    // Added for fallback
    // Add other categories as needed
};

// Add other shared backend types/enums here as needed

module.exports = {
  PoliticalBias,
  NewsCategory // Export NewsCategory
}; 