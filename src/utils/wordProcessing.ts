import { TagCloudWord, NewsItem, PoliticalBias, NewsCategory } from '../types';

// Common English stop words that don't add meaningful value to visualization
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'the', 'this', 'but', 'they', 'have', 'had', 'what', 'when',
  'where', 'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'can', 'just', 'should', 'now'
]);

// Words that might be meaningful in news context despite being stop words
const NEWS_SPECIFIC_WORDS = new Set([
  'breaking', 'exclusive', 'update', 'live', 'developing', 'urgent'
]);

// Section titles and category names (to filter out)
const CATEGORY_TITLE_WORDS = new Set(
  Object.values(NewsCategory).map(category => category.toLowerCase())
);

// Common newspaper section names to filter out
const SECTION_TITLE_WORDS = new Set([
  'world', 'us', 'politics', 'opinion', 'editorial', 'business', 'finance', 'money', 'economy', 'markets',
  'technology', 'tech', 'science', 'health', 'sports', 'arts', 'culture', 'entertainment', 'style', 'fashion',
  'travel', 'food', 'dining', 'real estate', 'home', 'education', 'books', 'obituaries', 'weather', 'local',
  'metro', 'national', 'international', 'magazine', 'weekend', 'sunday', 'columns', 'features', 'lifestyle',
  'society', 'law', 'crime', 'justice', 'environment', 'jobs', 'careers', 'autos', 'cars', 'classifieds',
  'events', 'calendar', 'letters', 'comics', 'puzzles', 'games', 'horoscopes', 'crosswords', 'photos',
  'video', 'multimedia'
]);

// Common less descriptive words that appear frequently in news
const COMMON_DESCRIPTIVE_WORDS = new Set([
  // Time-related words
  'today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'day', 'hour', 'minute',
  'morning', 'afternoon', 'evening', 'night', 'monday', 'tuesday', 'wednesday', 
  'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april',
  'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  
  // Descriptive verbs that don't add much meaning
  'says', 'said', 'told', 'announced', 'reported', 'claimed', 'stated', 'described',
  'appeared', 'revealed', 'suggested', 'mentioned', 'noted', 'added', 'explained',
  'confirmed', 'denied', 'asked', 'called', 'commented', 'shared', 'showed',
  
  // Common news article terms
  'report', 'story', 'article', 'headline', 'breaking', 'update', 'news', 'latest',
  'exclusive', 'interview', 'statement', 'press', 'release', 'analysis', 'opinion',
  'editorial', 'feature', 'briefing', 'recap', 'roundup', 'summary', 'preview',
  'review', 'guide', 'explainer', 'breakdown', 'profile', 'description', 'cartoon', 'cover',
  
  // General words that don't provide specific content
  'amid', 'despite', 'following', 'according', 'regarding', 'concerning',
  'per', 'via', 'through', 'throughout', 'during', 'before', 'after',
  'among', 'between', 'within', 'around', 'across', 'along', 'beyond',
  
  // High-frequency adjectives in news
  'new', 'top', 'big', 'major', 'key', 'important', 'significant', 'critical',
  'essential', 'vital', 'crucial', 'main', 'primary', 'secondary', 'notable',
  'recent', 'latest', 'current', 'ongoing', 'developing', 'upcoming', 'potential',
  'possible', 'likely', 'unlikely', 'certain', 'controversial', 'popular',
  
  // Additional common news terms
  'first', 'second', 'third', 'last', 'next', 'previous', 'final',
  'begin', 'began', 'begun', 'start', 'started', 'end', 'ended',
  'show', 'shows', 'showing', 'shown', 'see', 'sees', 'seen', 'saw',
  'watch', 'watched', 'watching', 'look', 'looked', 'looking',
  'think', 'thought', 'thinking', 'make', 'made', 'making',
  'take', 'took', 'taken', 'taking', 'get', 'got', 'getting',
  'find', 'found', 'finding', 'use', 'used', 'using',
  'tell', 'telling', 'become', 'became', 'becoming',
  
  // Title prefixes that should be removed
  'president', 'vice', 'senator', 'rep', 'representative', 'secretary',
  'governor', 'mayor', 'chief', 'director', 'chairman', 'chairwoman',
  'spokesperson', 'minister', 'chancellor', 'prime', 'king', 'queen',
  'prince', 'princess', 'duke', 'duchess', 'sir', 'dame', 'ceo',
  'founder', 'official', 'leader', 'spokesman', 'spokeswoman'
]);

// Common news source names to filter out
const NEWS_SOURCE_NAMES = new Set([
  'cnn', 'msnbc', 'nytimes', 'times', 'post', 'wapo', 'npr', 'abc', 'cbs', 'nbc', 
  'mother', 'jones', 'nation', 'huffington', 'vox', 'vanity', 'fair', 'newyorker', 
  'truthout', 'alternet', 'intercept', 'truthdig', 'reuters', 'bbc', 'axios', 
  'bloomberg', 'wall', 'journal', 'wsj', 'forbes', 'dailywire', 'breitbart', 'fox',
  'economist', 'aljazeera', 'guardian', 'dw', 'cnbc', 'wires', 'news', 'newsmax', 
  'american', 'conservative', 'unz', 'daily', 'caller', 'politicalinsider', 'source',
  'ap', 'associated', 'press', 'hill', 'newsweek'
]);

// Maximum words per bias category to ensure balance
const MAX_WORDS_PER_BIAS = 100;

// Configuration options for word processing
export interface WordProcessingConfig {
  minWordLength: number;        // Minimum length of words to include
  maxWordLength: number;        // Maximum length of words to include
  minFrequency: number;         // Minimum frequency for a word to be included
  maxWords: number;             // Maximum number of words to include in cloud
  removeStopWords: boolean;     // Whether to remove stop words
  combineWordForms: boolean;    // Whether to combine similar word forms
}

// Default configuration
export const DEFAULT_WORD_PROCESSING_CONFIG: WordProcessingConfig = {
  minWordLength: 3,        // Allow shorter words
  maxWordLength: 30,       // Allow longer words/phrases
  minFrequency: 1,         // Include words that appear only once
  maxWords: 500,           // Allow many more words
  removeStopWords: true,   // Keep filtering stop words
  combineWordForms: true  // Combine word forms to preserve variety
};

// Map of known entities and their canonical forms
// This helps normalize entities like "Trump", "Donald Trump", "President Trump" to a single form
const ENTITY_CANONICAL_FORMS: Record<string, string> = {
  // Political figures - US
  'trump': 'trump',
  'donald trump': 'trump',
  'president trump': 'trump',
  'former president trump': 'trump',
  'donald j trump': 'trump',
  
  'biden': 'biden',
  'joe biden': 'biden',
  'president biden': 'biden',
  'joseph biden': 'biden',
  'joseph r biden': 'biden',
  
  'obama': 'obama',
  'barack obama': 'obama',
  'president obama': 'obama',
  'former president obama': 'obama',
  
  'harris': 'harris',
  'kamala harris': 'harris',
  'vice president harris': 'harris',
  'vp harris': 'harris',
  
  'pence': 'pence',
  'mike pence': 'pence',
  'michael pence': 'pence',
  'vice president pence': 'pence',
  'former vice president pence': 'pence',
  
  // Political figures - International
  'putin': 'putin',
  'vladimir putin': 'putin',
  'president putin': 'putin',
  
  'zelensky': 'zelensky',
  'zelenskyy': 'zelensky',
  'volodymyr zelensky': 'zelensky',
  'president zelensky': 'zelensky',
  
  'xi': 'xi jinping',
  'xi jinping': 'xi jinping',
  'president xi': 'xi jinping',
  
  'trudeau': 'trudeau',
  'justin trudeau': 'trudeau',
  'prime minister trudeau': 'trudeau',
  
  // Organizations/Companies
  'meta': 'meta',
  'facebook': 'meta',
  'meta platforms': 'meta',
  
  'google': 'google',
  'alphabet': 'google',
  
  'amazon': 'amazon',
  'amazon.com': 'amazon',
  
  'apple': 'apple',
  'apple inc': 'apple',
  
  'microsoft': 'microsoft',
  'msft': 'microsoft',
  
  'openai': 'openai',
  'open ai': 'openai',
  
  'gop': 'republican party',
  'republican': 'republican party',
  'republicans': 'republican party',
  'republican party': 'republican party',
  
  'democrat': 'democratic party',
  'democrats': 'democratic party',
  'democratic party': 'democratic party',
  'dems': 'democratic party',
  
  // Countries/Regions
  'us': 'united states',
  'usa': 'united states',
  'united states': 'united states',
  'america': 'united states',
  
  'uk': 'united kingdom',
  'britain': 'united kingdom',
  'great britain': 'united kingdom',
  'united kingdom': 'united kingdom',
  
  'eu': 'european union',
  'european union': 'european union',
  
  'russia': 'russia',
  'russian federation': 'russia',
  
  'china': 'china',
  'prc': 'china',
  'peoples republic of china': 'china',
  
  'ukraine': 'ukraine',
  
  'israel': 'israel',
  
  'gaza': 'gaza',
  'gaza strip': 'gaza',
  
  'palestine': 'palestine',
  'palestinian territories': 'palestine'
};

/**
 * Simple word stemming function to find word roots
 * For example: "running" -> "run", "politics" -> "politic"
 */
const findWordRoot = (word: string): string => {
  if (word.length <= 3) return word;
  
  // Handle common suffixes
  if (word.endsWith('ing')) return word.slice(0, -3);
  if (word.endsWith('ed')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  if (word.endsWith('ly')) return word.slice(0, -2);
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('es')) return word.slice(0, -2);
  
  return word;
};

/**
 * Normalizes entities to their canonical forms
 * For example: "President Trump" -> "trump", "Joe Biden" -> "biden"
 */
const normalizeEntity = (term: string): string => {
  const lowerTerm = term.toLowerCase();
  
  // Direct lookup in our entity map
  if (ENTITY_CANONICAL_FORMS[lowerTerm]) {
    return ENTITY_CANONICAL_FORMS[lowerTerm];
  }
  
  // Check if this is a term with a title prefix (e.g., "President [Name]")
  const parts = lowerTerm.split(' ');
  if (parts.length > 1) {
    // If the first word is a title/prefix in common descriptive words, remove it
    // and check if the rest is in our entity map
    if (COMMON_DESCRIPTIVE_WORDS.has(parts[0])) {
      const withoutPrefix = parts.slice(1).join(' ');
      if (ENTITY_CANONICAL_FORMS[withoutPrefix]) {
        return ENTITY_CANONICAL_FORMS[withoutPrefix];
      }
    }
    
    // Check if the last part is a known entity (e.g., "Donald J. Trump" -> "Trump")
    const lastPart = parts[parts.length - 1];
    if (ENTITY_CANONICAL_FORMS[lastPart]) {
      return ENTITY_CANONICAL_FORMS[lastPart];
    }
  }
  
  // No normalization found, return the original term
  return term;
};

// Helper to normalize a word for descriptive/section filtering
function normalizeForFilter(word: string): string {
  let w = word.toLowerCase();
  if (w.endsWith("'s")) w = w.slice(0, -2);
  else if (w.endsWith("es")) w = w.slice(0, -2);
  else if (w.endsWith("s")) w = w.slice(0, -1);
  return w;
}

/**
 * Determines if a word should be kept based on the configuration
 */
const shouldKeepWord = (
  word: string,
  config: WordProcessingConfig
): boolean => {
  // Block all words containing "cartoon" in any form
  if (word.toLowerCase().includes('cartoon')) {
    return false;
  }

  // Check word length
  if (word.length < config.minWordLength || word.length > config.maxWordLength) {
    return false;
  }

  // Remove descriptive/section words and their possessive/plural forms
  const normalized = normalizeForFilter(word);
  if (COMMON_DESCRIPTIVE_WORDS.has(normalized) || SECTION_TITLE_WORDS.has(normalized)) {
    return false;
  }

  // For hyphenated or multi-word terms, check each part
  if (word.includes('-') || word.includes(' ')) {
    const parts = word.split(/\s|-+/);
    if (parts.every(part => 
      (STOP_WORDS.has(part) && !NEWS_SPECIFIC_WORDS.has(part)) || 
      CATEGORY_TITLE_WORDS.has(part) || 
      SECTION_TITLE_WORDS.has(part) ||
      COMMON_DESCRIPTIVE_WORDS.has(part) ||
      COMMON_DESCRIPTIVE_WORDS.has(normalizeForFilter(part)) ||
      SECTION_TITLE_WORDS.has(normalizeForFilter(part))
    )) {
      return false;
    }
  } else {
    // Single word checks
    if (config.removeStopWords && STOP_WORDS.has(word) && !NEWS_SPECIFIC_WORDS.has(word)) {
      return false;
    }
    if (NEWS_SOURCE_NAMES.has(word)) {
      return false;
    }
    if (CATEGORY_TITLE_WORDS.has(word) || SECTION_TITLE_WORDS.has(word)) {
      return false;
    }
    if (COMMON_DESCRIPTIVE_WORDS.has(word)) {
      return false;
    }
  }

  // Additional filters can be added here
  if (/^\d+$/.test(word)) {
    return false;
  }

  return true;
};

/**
 * Clean a string by removing/normalizing punctuation and HTML entities
 */
const cleanString = (str: string): string => {
  // Convert HTML entities like &amp; &apos; etc. to their character equivalents
  const decodedStr = str.replace(/&apos;/g, "'")
                         .replace(/&quot;/g, '"')
                         .replace(/&amp;/g, '&')
                         .replace(/&lt;/g, '<')
                         .replace(/&gt;/g, '>')
                         .replace(/&#39;/g, "'")
                         .replace(/&rsquo;/g, "'")
                         .replace(/&ldquo;|&rdquo;/g, '"');
  
  // Normalize apostrophes (replace fancy quotes with simple apostrophe)
  const normalizedApostrophes = decodedStr.replace(/['′'']/g, "'");
  
  // Remove all punctuation except apostrophes in words (like "don't")
  // Keep hyphens in compound words but remove other punctuation
  return normalizedApostrophes.replace(/[.,;:!?()[\]{}"\\|@#$%^&*+=_~<>]/g, '')
                              .replace(/\s-+\s/g, ' '); // Remove standalone hyphens
};

/**
 * Processes news items to generate refined tag cloud words with balanced bias distribution
 */
export const processNewsToWords = async (
  news: NewsItem[],
  config = DEFAULT_WORD_PROCESSING_CONFIG
): Promise<TagCloudWord[]> => {
  // Create separate maps for each bias category
  const biasMaps = new Map<PoliticalBias, Map<string, TagCloudWord>>();
  Object.values(PoliticalBias).forEach(bias => {
    biasMaps.set(bias, new Map<string, TagCloudWord>());
  });
  
  // Process words into their respective bias categories
  for (const item of news) {
    // Skip items with undefined bias or keywords
    if (!item.source?.bias || !item.keywords) continue;
    
    // Default to Unclear bias if the bias is not in our map
    const bias = biasMaps.has(item.source.bias) ? item.source.bias : PoliticalBias.Unclear;
    
    for (const word of item.keywords) {
      let normalizedWord = cleanString(word).toLowerCase().trim();
      
      // Skip words that don't meet basic criteria
      if (!shouldKeepWord(normalizedWord, config)) {
        continue;
      }

      // Try to normalize entities first
      normalizedWord = normalizeEntity(normalizedWord);
      
      // Find word root if combining word forms is enabled
      if (config.combineWordForms) {
        normalizedWord = findWordRoot(normalizedWord);
      }
      
      const biasMap = biasMaps.get(bias)!;
      
      if (biasMap.has(normalizedWord)) {
        // Update existing word
        const existingWord = biasMap.get(normalizedWord)!;
        existingWord.value += 1;
        if (!existingWord.newsIds.includes(item.id)) {
          existingWord.newsIds.push(item.id);
        }
      } else {
        // Create new word
        biasMap.set(normalizedWord, {
          text: normalizedWord,
          value: 1,
          bias: bias,
          newsIds: [item.id],
          category: item.category
        });
      }
    }
  }
  
  // Collect words from each bias category with equal representation
  const balancedWords: TagCloudWord[] = [];
  const minFreq = config.minFrequency || 1;
  
  // First, filter by minimum frequency and sort by value for each bias
  const sortedBiasWords = new Map<PoliticalBias, TagCloudWord[]>();
  biasMaps.forEach((wordMap, bias) => {
    const words = Array.from(wordMap.values())
      .filter(word => word.value >= minFreq)
      .sort((a, b) => b.value - a.value);
    sortedBiasWords.set(bias, words);
  });
  
  // Find the minimum number of words available across all biases
  const minWordsAvailable = Math.min(
    ...Array.from(sortedBiasWords.values()).map(words => words.length)
  );
  
  // Calculate how many words to take from each bias category
  const wordsPerBias = Math.min(
    Math.floor(config.maxWords / Object.keys(PoliticalBias).length),
    minWordsAvailable,
    MAX_WORDS_PER_BIAS
  );
  
  // Take equal number of words from each bias category
  sortedBiasWords.forEach((words) => {
    balancedWords.push(...words.slice(0, wordsPerBias));
  });
  
  return balancedWords;
};

/**
 * Utility function to analyze word frequency distribution
 * Useful for tuning the word processing parameters
 */
export const analyzeWordDistribution = (words: TagCloudWord[]): {
  totalWords: number;
  uniqueWords: number;
  frequencyRange: { min: number; max: number };
  averageFrequency: number;
  lengthRange: { min: number; max: number };
  averageLength: number;
} => {
  const frequencies = words.map(w => w.value);
  const lengths = words.map(w => w.text.length);
  
  return {
    totalWords: words.reduce((sum, w) => sum + w.value, 0),
    uniqueWords: words.length,
    frequencyRange: {
      min: Math.min(...frequencies),
      max: Math.max(...frequencies)
    },
    averageFrequency: frequencies.reduce((sum, f) => sum + f, 0) / words.length,
    lengthRange: {
      min: Math.min(...lengths),
      max: Math.max(...lengths)
    },
    averageLength: lengths.reduce((sum, l) => sum + l, 0) / words.length
  };
}; 