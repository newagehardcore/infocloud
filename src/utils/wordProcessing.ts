import { TagCloudWord, NewsItem } from '../types';

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
  minWordLength: 2,        // Allow shorter words
  maxWordLength: 30,       // Allow longer words/phrases
  minFrequency: 1,         // Include words that appear only once
  maxWords: 500,           // Allow many more words
  removeStopWords: true,   // Keep filtering stop words
  combineWordForms: false  // Don't combine word forms to preserve variety
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
 * Determines if a word should be kept based on the configuration
 */
const shouldKeepWord = (
  word: string,
  config: WordProcessingConfig
): boolean => {
  // Check word length
  if (word.length < config.minWordLength || word.length > config.maxWordLength) {
    return false;
  }

  // Check if it's a stop word (but allow news-specific exceptions)
  if (config.removeStopWords && STOP_WORDS.has(word) && !NEWS_SPECIFIC_WORDS.has(word)) {
    return false;
  }
  
  // Check if it's a news source name
  if (NEWS_SOURCE_NAMES.has(word)) {
    return false;
  }

  // Additional filters can be added here
  // Reject words that are just numbers
  if (/^\d+$/.test(word)) {
    return false;
  }

  return true;
};

/**
 * Processes news items to generate refined tag cloud words
 */
export const processNewsToWords = async (
  news: NewsItem[],
  config: WordProcessingConfig = DEFAULT_WORD_PROCESSING_CONFIG
): Promise<TagCloudWord[]> => {
  const wordMap = new Map<string, TagCloudWord>();
  
  for (const item of news) {
    // Process each keyword from the news item
    for (const word of item.keywords) {
      let normalizedWord = word.toLowerCase().trim();
      
      // Skip words that don't meet basic criteria
      if (!shouldKeepWord(normalizedWord, config)) {
        continue;
      }

      // Find word root if combining word forms is enabled
      if (config.combineWordForms) {
        normalizedWord = findWordRoot(normalizedWord);
      }
      
      if (wordMap.has(normalizedWord)) {
        // Update existing word
        const existingWord = wordMap.get(normalizedWord)!;
        existingWord.value += 1;
        if (!existingWord.newsIds.includes(item.id)) {
          existingWord.newsIds.push(item.id);
        }
      } else {
        // Create new word
        wordMap.set(normalizedWord, {
          text: normalizedWord,
          value: 1,
          bias: item.source.bias,
          newsIds: [item.id],
          category: item.category
        });
      }
    }
  }
  
  // Convert map to array and apply frequency threshold
  let words = Array.from(wordMap.values())
    .filter(word => word.value >= config.minFrequency)
    .sort((a, b) => b.value - a.value)
    .slice(0, config.maxWords);

  return words;
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