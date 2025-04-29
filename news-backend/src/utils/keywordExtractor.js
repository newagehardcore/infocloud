const nlp = require('compromise');

// Helper function to decode HTML entities (simplified version)
const decodeHtml = (html) => {
  if (typeof html !== 'string') return '';
  // Basic decoding, can be expanded if more entities are needed
  return html.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#039;/g, "'")
             .replace(/&apos;/g, "'") // Added apostrophe
             .replace(/&nbsp;/g, ' ');
};

// Re-introduce a basic stop word list for initial filtering
const BASIC_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'this', 'but', 'they', 'have', 'had', 'what', 'when',
  'where', 'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'can', 'just', 'should', 'now', 'she', 'him', 'her',
  // Add a few more very common verbs/pronouns often missed by basic lists
  'say', 'get', 'go', 'do', 'us', 'we', 'you', 'your' 
]);

// Stop words and media names will be filtered downstream in wordProcessing.ts
// const stopWords = new Set([...]); // REMOVED
// const mediaSourceNames = new Set([...]); // REMOVED

/**
 * Extracts keywords from a news item using compromise NLP library.
 * Focuses on nouns, topics, entities, and noun phrases.
 * @param {object} newsItem - The news item object (should have title and description).
 * @returns {Promise<string[]>} A promise that resolves to an array of keywords.
 */
const extractKeywords = async (newsItem) => {
  if (!newsItem || !newsItem.title) {
    return [];
  }

  try {
    const textToAnalyze = `${decodeHtml(newsItem.title)}. ${decodeHtml(newsItem.description || '')}`;
    const doc = nlp(textToAnalyze);

    // Extract various types of terms - **NO VERBS**
    const nouns = doc.nouns().out('array');
    const topics = doc.topics().out('array');
    const organizations = doc.organizations().out('array');
    const places = doc.places().out('array');
    const people = doc.people().out('array');
    const acronyms = doc.acronyms().out('array');
    // const verbsInfinitive = doc.verbs().toInfinitive().out('array'); // REMOVED VERBS
    const nounPhrases = doc.match('#NounPhrase+').out('array'); 

    let combinedKeywords = [
        ...nouns, 
        ...topics, 
        ...organizations, 
        ...places, 
        ...people, 
        ...acronyms,
        // ...verbsInfinitive, // REMOVED VERBS
        ...nounPhrases 
    ];

    // Clean and filter terms
    const cleanTerm = (term) => {
        if (typeof term !== 'string') return '';
        let cleaned = term.trim().toLowerCase();
        // Remove possessive 's
        cleaned = cleaned.replace(/'s$/, ''); 
        // Remove leading/trailing punctuation (keeps internal hyphens/apostrophes)
        cleaned = cleaned.replace(/^[.,!?;:]+|[.,!?;:]+$/g, '');
        // Remove specific symbols that might remain
        cleaned = cleaned.replace(/[()[\]{}"]/g, ''); 
        return cleaned;
    };

    const processedKeywords = combinedKeywords
      .map(cleanTerm)
      .filter(term => {
          if (!term) return false;
          const lowerTerm = term; // Already lowercase
          
          // Basic filters
          if (lowerTerm.length <= 2) return false; // Min length
          if (/^\d+$/.test(lowerTerm)) return false; // Is numeric
          if (BASIC_STOP_WORDS.has(lowerTerm)) return false; // ADDED basic stop word check here
                    
          // Filter out terms containing "cartoon"
          if (lowerTerm.includes('cartoon')) return false;
                    
          return true;
      });
      
    // Get unique keywords and limit the count
    const uniqueKeywords = Array.from(new Set(processedKeywords));
    const MAX_KEYWORDS = 25; 
    const finalKeywords = uniqueKeywords.slice(0, MAX_KEYWORDS);

    // Add debug logging for keyword extraction
    console.log(`[KeywordExtractor] Found ${finalKeywords.length} keywords for article from ${newsItem.source?.name || 'unknown source'} (bias: ${newsItem.source?.bias || 'unknown'})`);
    if (finalKeywords.length === 0) {
      console.log(`[KeywordExtractor] No keywords found for: "${newsItem.title.substring(0, 50)}..."`);
    }
    
    return finalKeywords;

  } catch (error) {
    console.error(`Error extracting keywords for "${newsItem.title}":`, error);
    // Basic fallback: split title, filter stop words
    const fallbackKeywords = newsItem.title
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/^[.,!?;:]+|[.,!?;:]+$/g, ''))
      .filter(word => word.length > 3 && !BASIC_STOP_WORDS.has(word) && !word.includes('cartoon')) 
      .slice(0, 10);
    
    console.log(`[KeywordExtractor] Used fallback method, found ${fallbackKeywords.length} keywords from title`);
    return fallbackKeywords;
  }
};

module.exports = { extractKeywords };
