// Define constants for PoliticalBias (matching rssService.js and NewsItem model)
const PoliticalBias = {
  AlternativeLeft: 'Alternative Left',
  MainstreamDemocrat: 'Mainstream Democrat',
  Centrist: 'Centrist',
  Unclear: 'Unclear',
  MainstreamRepublican: 'Mainstream Republican',
  AlternativeRight: 'Alternative Right',
};

/**
 * Analyzes political bias based on a source name.
 * Uses a predefined mapping and simple matching.
 * Intended for use with API sources where bias isn't directly provided.
 * @param {string} sourceName - The name of the news source.
 * @returns {string} The determined PoliticalBias value (e.g., 'Centrist').
 */
const analyzeMediaBias = (sourceName) => {
  if (!sourceName || typeof sourceName !== 'string') {
    return PoliticalBias.Unclear;
  }
  
  // This is a simplified mapping based on the frontend code search results
  // This should ideally be configurable or use a more robust external service/database
  const sourceMapping = {
    // Mainstream Democrat
    'CNN': PoliticalBias.MainstreamDemocrat,
    'MSNBC': PoliticalBias.MainstreamDemocrat,
    'New York Times': PoliticalBias.MainstreamDemocrat,
    'The New York Times': PoliticalBias.MainstreamDemocrat,
    'Washington Post': PoliticalBias.MainstreamDemocrat,
    'NPR': PoliticalBias.MainstreamDemocrat,
    'ABC News': PoliticalBias.MainstreamDemocrat,
    'CBS News': PoliticalBias.MainstreamDemocrat,
    'NBC News': PoliticalBias.MainstreamDemocrat,
    'Time': PoliticalBias.MainstreamDemocrat,
    'The Guardian': PoliticalBias.MainstreamDemocrat, // Added from other list
    'Vox': PoliticalBias.AlternativeLeft, // Moved to Alt Left based on other lists
    'Huffington Post': PoliticalBias.AlternativeLeft, // Moved to Alt Left
    'Vanity Fair': PoliticalBias.MainstreamDemocrat, // Kept Mainstream Dem based on RSS list
    'The New Yorker': PoliticalBias.MainstreamDemocrat, // Kept Mainstream Dem based on RSS list
    
    // Alternative Left
    'Mother Jones': PoliticalBias.AlternativeLeft,
    'Democracy Now': PoliticalBias.AlternativeLeft,
    'FAIR': PoliticalBias.AlternativeLeft, // Added from RSS list
    'Truthout': PoliticalBias.AlternativeLeft, // Added from RSS list
    'AlterNet': PoliticalBias.AlternativeLeft, // Added from RSS list
    'The Intercept': PoliticalBias.AlternativeLeft, // Added from RSS list
    'Truthdig': PoliticalBias.AlternativeLeft, // Added from RSS list
    'Raw Story': PoliticalBias.AlternativeLeft, // Added from other list

    // Centrist
    'Associated Press': PoliticalBias.Centrist,
    'Reuters': PoliticalBias.Centrist,
    'BBC': PoliticalBias.Centrist,
    'Christian Science Monitor': PoliticalBias.Centrist,
    'Axios': PoliticalBias.Centrist,
    'Bloomberg': PoliticalBias.Centrist,
    'USA Today': PoliticalBias.Centrist,
    'The Hill': PoliticalBias.Centrist,
    'PBS': PoliticalBias.Centrist, // Added from RSS list
    'The Economist': PoliticalBias.Centrist,
    'Financial Times': PoliticalBias.Centrist,
    'Deutsche Welle': PoliticalBias.Centrist, // Added from other list
    'France 24': PoliticalBias.Centrist, // Added from other list
    'Times of India': PoliticalBias.Centrist, // Added from RSS list
    'CNBC': PoliticalBias.Centrist, // Added from RSS list

    // Mainstream Republican
    'Wall Street Journal': PoliticalBias.MainstreamRepublican,
    'Washington Times': PoliticalBias.MainstreamRepublican,
    'National Review': PoliticalBias.MainstreamRepublican,
    'Fox News': PoliticalBias.MainstreamRepublican,
    'New York Post': PoliticalBias.MainstreamRepublican,
    'Forbes': PoliticalBias.MainstreamRepublican,

    // Alternative Right
    'The Daily Wire': PoliticalBias.AlternativeRight,
    'The American Conservative': PoliticalBias.AlternativeRight,
    'Breitbart': PoliticalBias.AlternativeRight,
    'The Daily Caller': PoliticalBias.AlternativeRight,
    'Newsmax': PoliticalBias.AlternativeRight, // Added from other list
    'The Political Insider': PoliticalBias.AlternativeRight, // Added from RSS list

    // International - Bias can be complex, often categorized differently or unclear
    'Al Jazeera': PoliticalBias.Unclear, // Kept Unclear based on RSS list
  };

  const lowerSourceName = sourceName.toLowerCase();
  
  // Look for exact match (case-insensitive)
  for (const source in sourceMapping) {
    if (source.toLowerCase() === lowerSourceName) {
      return sourceMapping[source];
    }
  }
  
  // Look for partial match (more prone to errors, use with caution)
  // Example: If sourceName is "NYT News", it might match "New York Times"
  for (const source in sourceMapping) {
      const lowerMappedSource = source.toLowerCase();
      if (lowerSourceName.includes(lowerMappedSource) || lowerMappedSource.includes(lowerSourceName)) {
          // console.warn(`Partial bias match: "${sourceName}" matched with "${source}" -> ${sourceMapping[source]}`);
          return sourceMapping[source];
      }
  }
  
  // Default to unclear if no match found
  // console.log(`Bias not found for source: "${sourceName}", defaulting to Unclear.`);
  return PoliticalBias.Unclear;
};

module.exports = { analyzeMediaBias, PoliticalBias }; 