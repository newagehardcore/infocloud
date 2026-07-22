const BIAS_CATEGORIES = [
    'LEFT',
    'LIBERAL',
    'CENTRIST',
    'CONSERVATIVE',
    'RIGHT',
    'UNKNOWN'
];

const SOURCE_TYPES = [
    'INDEPENDENT',
    'CORPORATE',
    'STATE',
    'UNKNOWN'
];

// Add debug
console.log('[Constants] Loading constants.js module');
console.log('[Constants] SOURCE_TYPES defined:', SOURCE_TYPES);

module.exports = {
    BIAS_CATEGORIES,
    SOURCE_TYPES
}; 