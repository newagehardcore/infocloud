// Define constants for PoliticalBias (matching frontend types)
const PoliticalBias = {
  Left: 'Left',
  Liberal: 'Liberal',
  Centrist: 'Centrist',
  Unknown: 'Unknown',
  Conservative: 'Conservative',
  Right: 'Right'
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
    return PoliticalBias.Unknown;
  }
  
  // This is a simplified mapping based on the frontend code search results
  // This should ideally be configurable or use a more robust external service/database
  const sourceMapping = {
    // Liberal
    'CNN': PoliticalBias.Liberal,
    'MSNBC': PoliticalBias.Liberal,
    'New York Times': PoliticalBias.Liberal,
    'The New York Times': PoliticalBias.Liberal,
    'Washington Post': PoliticalBias.Liberal,
    'NPR': PoliticalBias.Liberal,
    'ABC News': PoliticalBias.Liberal,
    'CBS News': PoliticalBias.Liberal,
    'NBC News': PoliticalBias.Liberal,
    'Time': PoliticalBias.Liberal,
    'The Guardian': PoliticalBias.Liberal,
    'Vanity Fair': PoliticalBias.Liberal,
    'The New Yorker': PoliticalBias.Liberal,
    
    // Left
    'Mother Jones': PoliticalBias.Left,
    'Democracy Now': PoliticalBias.Left,
    'FAIR': PoliticalBias.Left,
    'Truthout': PoliticalBias.Left,
    'AlterNet': PoliticalBias.Left,
    'The Intercept': PoliticalBias.Left,
    'Truthdig': PoliticalBias.Left,
    'Raw Story': PoliticalBias.Left,
    'Vox': PoliticalBias.Left,
    'Huffington Post': PoliticalBias.Left,

    // Centrist
    'Associated Press': PoliticalBias.Centrist,
    'Reuters': PoliticalBias.Centrist,
    'BBC': PoliticalBias.Centrist,
    'Christian Science Monitor': PoliticalBias.Centrist,
    'Axios': PoliticalBias.Centrist,
    'Bloomberg': PoliticalBias.Centrist,
    'USA Today': PoliticalBias.Centrist,
    'The Hill': PoliticalBias.Centrist,
    'PBS': PoliticalBias.Centrist,
    'The Economist': PoliticalBias.Centrist,
    'Financial Times': PoliticalBias.Centrist,
    'Deutsche Welle': PoliticalBias.Centrist,
    'France 24': PoliticalBias.Centrist,
    'Times of India': PoliticalBias.Centrist,
    'CNBC': PoliticalBias.Centrist,

    // Conservative
    'Wall Street Journal': PoliticalBias.Conservative,
    'Washington Times': PoliticalBias.Conservative,
    'National Review': PoliticalBias.Conservative,
    'Fox News': PoliticalBias.Conservative,
    'New York Post': PoliticalBias.Conservative,
    'Forbes': PoliticalBias.Conservative,

    // Right
    'The Daily Wire': PoliticalBias.Right,
    'The American Conservative': PoliticalBias.Right,
    'Breitbart': PoliticalBias.Right,
    'The Daily Caller': PoliticalBias.Right,
    'Newsmax': PoliticalBias.Right,
    'The Political Insider': PoliticalBias.Right,

    // International - Bias can be complex
    'Al Jazeera': PoliticalBias.Unknown,
  };

  const lowerSourceName = sourceName.toLowerCase();
  
  // Look for exact match (case-insensitive)
  for (const source in sourceMapping) {
    if (source.toLowerCase() === lowerSourceName) {
      return sourceMapping[source];
    }
  }
  
  // Look for partial match (more prone to errors, use with caution)
  for (const source in sourceMapping) {
      const lowerMappedSource = source.toLowerCase();
      if (lowerSourceName.includes(lowerMappedSource) || lowerMappedSource.includes(lowerSourceName)) {
          return sourceMapping[source];
      }
  }
  
  return PoliticalBias.Unknown;
};

module.exports = { PoliticalBias, analyzeMediaBias }; 