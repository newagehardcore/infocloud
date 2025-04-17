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

// Combined and simplified stop word list from the original code
const stopWords = new Set([
  // Standard English stop words
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'from', 'of', 'for', 'with', 
  'it', 'its', 'is', 'was', 'were', 'be', 'being', 'been', 'he', 'she', 'they', 'them', 'their', 
  'this', 'that', 'these', 'those', 'i', 'you', 'me', 'my', 'your', 'we', 'us', 'our', 
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could',
  'may', 'might', 'must', 'about', 'above', 'below', 'over', 'under', 'again', 'further', 'then', 
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 
  'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 're', 've', 'll',
  // Common news/article related words
  'news', 'article', 'source', 'feed', 'rss', 'update', 'updates', 'story', 'report', 'reports', 
  'says', 'said', 'told', 'also', 'like', 'via', 'pm', 'am', 'gmt', 'est', 'edt', 'pst', 'pdt',
  'read', 'view', 'comments', 'share', 'follow', 'copyright', 'reserved', 'rights', 'advertisement',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 
  'october', 'november', 'december', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 
  'saturday', 'sunday', 'today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'time',
  'new', 'old', 'first', 'last', 'next', 'previous', 'world', 'politics', 'us', 'u.s', 'u.s.',
  'no.', 'inc.', 'ltd.', 'corp.', 'co.', 'llc', '-', '--', '...', '', 
  // From wordProcessing.ts lists
  'breaking', 'exclusive', 'live', 'developing', 'urgent',
  'opinion', 'editorial', 'business', 'finance', 'money', 'economy', 'markets', 'technology', 'tech', 
  'science', 'health', 'sports', 'arts', 'culture', 'entertainment', 'style', 'fashion', 'travel', 
  'food', 'dining', 'real estate', 'home', 'education', 'books', 'obituaries', 'weather', 'local',
  'metro', 'national', 'international', 'magazine', 'weekend', 'sunday', 'columns', 'features', 'lifestyle',
  'society', 'law', 'crime', 'justice', 'environment', 'jobs', 'careers', 'autos', 'cars', 'classifieds',
  'events', 'calendar', 'letters', 'comics', 'puzzles', 'games', 'horoscopes', 'crosswords', 'photos',
  'video', 'audio', 'podcast', 'image', 'photo', 'picture', 'clip', 'series', 'episode', 'season', 'show', 
  'film', 'documentary', 'announced', 'reported', 'claimed', 'stated', 'described', 'appeared', 'revealed', 
  'suggested', 'mentioned', 'noted', 'added', 'explained', 'confirmed', 'denied', 'asked', 'called', 
  'commented', 'shared', 'showed', 'headline', 'latest', 'interview', 'statement', 'press', 'release', 
  'analysis', 'feature', 'briefing', 'recap', 'roundup', 'summary', 'preview', 'review', 'guide', 
  'explainer', 'breakdown', 'profile', 'description', 'cartoon', 'cover', 'amid', 'despite', 'following', 
  'according', 'regarding', 'concerning', 'per', 'through', 'throughout', 'during', 'before', 'after',
  'among', 'between', 'within', 'around', 'across', 'along', 'beyond', 'top', 'big', 'major', 'key', 
  'important', 'significant', 'critical', 'essential', 'vital', 'crucial', 'main', 'primary', 'secondary', 
  'notable', 'recent', 'current', 'ongoing', 'developing', 'upcoming', 'potential', 'possible', 
  'likely', 'unlikely', 'certain', 'controversial', 'popular', 'final', 'begin', 'began', 'begun', 
  'start', 'started', 'end', 'ended', 'shows', 'showing', 'shown', 'see', 'sees', 'seen', 'saw',
  'watch', 'watched', 'watching', 'look', 'looked', 'looking', 'think', 'thought', 'thinking', 'make', 
  'made', 'making', 'take', 'took', 'taken', 'taking', 'get', 'got', 'getting', 'find', 'found', 
  'finding', 'use', 'used', 'using', 'tell', 'telling', 'become', 'became', 'becoming', 
  'president', 'vice', 'senator', 'rep', 'representative', 'secretary', 'governor', 'mayor', 'chief', 
  'director', 'chairman', 'chairwoman', 'spokesperson', 'minister', 'chancellor', 'prime', 'king', 
  'queen', 'prince', 'princess', 'duke', 'duchess', 'sir', 'dame', 'ceo', 'founder', 'official', 
  'leader', 'spokesman', 'spokeswoman'
]);

// List of media source names to filter out from keywords (lowercase)
const mediaSourceNames = new Set([
  // Mainstream Democrat
  'cnn', 'msnbc', 'new york times', 'the new york times', 'washington post',
  'npr', 'abc news', 'cbs news', 'nbc news', 'time', 'nytimes', 'wapo',
  // Alternative Left
  'mother jones', 'democracy now', 'huffington post', 'vox', 'huffpost',
  'vanity fair', 'the new yorker', 'fair', 'truthout', 'alternet', 
  'the intercept', 'truthdig', 'raw story', 'newyorker',
  // Centrist
  'associated press', 'reuters', 'bbc', 'christian science monitor', 'ap',
  'axios', 'bloomberg', 'usa today', 'the hill', 'pbs', 'newsweek', 'hill',
  // Mainstream Republican
  'wall street journal', 'washington times', 'national review', 'fox news',
  'new york post', 'forbes', 'wsj', 'fox', 'nypost',
  // Alternative Right
  'the daily wire', 'the american conservative', 'breitbart', 'the daily caller', 'dailywire', 'dailycaller',
  'the political insider', 'newsmax', 'unz',
  // Mixed/Financial
  'the economist', 'financial times', 'cnbc', 'economist',
  // International
  'al jazeera', 'the guardian', 'deutsche welle', 'france 24', 'times of india', 'guardian', 'dw',
  // General
  'wires', 'source'
]);

/**
 * Extracts keywords from a news item using compromise NLP library.
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

    // Extract various types of terms
    const nouns = doc.nouns().out('array');
    const topics = doc.topics().out('array');
    const organizations = doc.organizations().out('array');
    const places = doc.places().out('array');
    const people = doc.people().out('array');
    const acronyms = doc.acronyms().out('array');
    const verbsInfinitive = doc.verbs().toInfinitive().out('array'); // Get infinitive verbs
    // Consider adding noun phrases if needed: doc.match('#Adjective? #Noun+').out('array')

    let combinedKeywords = [
        ...nouns, 
        ...topics, 
        ...organizations, 
        ...places, 
        ...people, 
        ...acronyms,
        ...verbsInfinitive
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
          if (stopWords.has(lowerTerm)) return false; // Is stop word
          
          // Filter out media source names (check partial matches too)
          if (mediaSourceNames.has(lowerTerm)) return false;
          for (const sourceName of mediaSourceNames) {
            if (lowerTerm.includes(sourceName)) return false;
          }
          
          // Filter out terms containing "cartoon"
          if (lowerTerm.includes('cartoon')) return false;
          
          // Optional: Filter simple verbs if too generic (already done via infinitive?)
          // if (doc.verbs().has(lowerTerm) && term.length < 5) return false; 

          return true;
      });
      
    // Get unique keywords and limit the count
    const uniqueKeywords = Array.from(new Set(processedKeywords));
    const MAX_KEYWORDS = 15; // Keep the limit reasonable
    const finalKeywords = uniqueKeywords.slice(0, MAX_KEYWORDS);

    // console.log(`Keywords for "${newsItem.title.substring(0,30)}...": ${finalKeywords.join(', ')}`);
    return finalKeywords;

  } catch (error) {
    console.error(`Error extracting keywords for "${newsItem.title}":`, error);
    // Basic fallback: split title, filter stop words
    return newsItem.title
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/^[.,!?;:]+|[.,!?;:]+$/g, ''))
      .filter(word => word.length > 3 && !stopWords.has(word) && !mediaSourceNames.has(word) && !word.includes('cartoon'))
      .slice(0, 10);
  }
};

module.exports = { extractKeywords };
