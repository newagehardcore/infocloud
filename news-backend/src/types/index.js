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
    ECONOMICS: 'ECONOMICS', // Renamed from BUSINESS, matches frontend/DB
    SPORTS: 'SPORTS',
    WORLD: 'WORLD',
    ENTERTAINMENT: 'ENTERTAINMENT',
    ENVIRONMENT: 'ENVIRONMENT',
    HEALTH: 'HEALTH',
    US: 'US',
    MUSIC: 'MUSIC',         // Added
    LAW: 'LAW',             // Added
    AI: 'AI',               // Added
    SPACE: 'SPACE',         // Added
    FASHION: 'FASHION',     // Added
    ARTS: 'ARTS',           // Added
    UNKNOWN: 'UNKNOWN'
    // Add other categories as needed
};

// Add other shared backend types/enums here as needed

module.exports = {
  PoliticalBias,
  NewsCategory // Export NewsCategory
}; 