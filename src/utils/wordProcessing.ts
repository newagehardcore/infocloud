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
  'video', 'multimedia', 'podcast', 'audio', 'gallery', 'slideshow', 'infographic', 'advertisement', 'sponsored',
  'subscription', 'subscribe', 'donate', 'support', 'contact', 'about', 'staff', 'corrections', 'archives'
]);

// Common less descriptive words that appear frequently in news
const COMMON_DESCRIPTIVE_WORDS = new Set([
  // Time-related words
  'today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'day', 'hour', 'minute', 'second',
  'morning', 'afternoon', 'evening', 'night', 'midnight', 'noon', 'daily', 'weekly', 'monthly', 'annual', 'biannual',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'date', 'time', 'period', 'season', 'era', 'century', 'decade', 'moment', 'schedule',
  
  // Descriptive verbs that don't add much meaning (base forms and common conjugations)
  'says', 'said', 'say', 'saying', 'told', 'tell', 'telling', 'announced', 'announce', 'announcing',
  'reported', 'report', 'reporting', 'claimed', 'claim', 'claiming', 'stated', 'state', 'stating',
  'described', 'describe', 'describing', 'appeared', 'appear', 'appearing', 'revealed', 'reveal', 'revealing',
  'suggested', 'suggest', 'suggesting', 'mentioned', 'mention', 'mentioning', 'noted', 'note', 'noting',
  'added', 'add', 'adding', 'explained', 'explain', 'explaining', 'confirmed', 'confirm', 'confirming',
  'denied', 'deny', 'denying', 'asked', 'ask', 'asking', 'called', 'call', 'calling', 'commented', 'comment', 'commenting',
  'shared', 'share', 'sharing', 'showed', 'show', 'showing', 'seen', 'see', 'seeing', 'saw',
  'found', 'find', 'finding', 'gave', 'give', 'giving', 'got', 'get', 'getting', 'went', 'go', 'going',
  'knew', 'know', 'knowing', 'made', 'make', 'making', 'took', 'take', 'taking', 'thought', 'think', 'thinking',
  'used', 'use', 'using', 'wanted', 'want', 'wanting', 'worked', 'work', 'working', 'came', 'come', 'coming',
  'become', 'became', 'becoming', 'began', 'begin', 'beginning', 'ended', 'end', 'ending', 'started', 'start', 'starting',
  'continued', 'continue', 'continuing', 'remained', 'remain', 'remaining', 'seemed', 'seem', 'seeming', 'helped', 'help', 'helping',
  'played', 'play', 'playing', 'moved', 'move', 'moving', 'liked', 'like', 'liking', 'lived', 'live', 'living', 'believed', 'believe', 'believing',
  'brought', 'bring', 'bringing', 'happened', 'happen', 'happening', 'watched', 'watch', 'watching', 'followed', 'follow', 'following',
  'stopped', 'stop', 'stopping', 'created', 'create', 'creating', 'spoke', 'speak', 'speaking', 'read', 'reading', 'allowed', 'allow', 'allowing',
  'led', 'lead', 'leading', 'grew', 'grow', 'growing', 'offered', 'offer', 'offering', 'remembered', 'remember', 'remembering',
  'considered', 'consider', 'considering', 'waited', 'wait', 'waiting', 'served', 'serve', 'serving', 'died', 'die', 'dying',
  'sent', 'send', 'sending', 'expected', 'expect', 'expecting', 'built', 'build', 'building', 'stayed', 'stay', 'staying',
  'fell', 'fall', 'falling', 'reached', 'reach', 'reaching', 'killed', 'kill', 'killing', 'raised', 'raise', 'raising',
  'passed', 'pass', 'passing', 'sold', 'sell', 'selling', 'required', 'require', 'requiring', 'decided', 'decide', 'deciding',
  'pulled', 'pull', 'pulling', 'returned', 'return', 'returning', 'hoped', 'hope', 'hoping', 'paid', 'pay', 'paying',
  
  // Common news article terms
  'report', 'story', 'article', 'headline', 'breaking', 'update', 'news', 'latest',
  'exclusive', 'interview', 'statement', 'press', 'release', 'analysis', 'opinion',
  'editorial', 'feature', 'briefing', 'recap', 'roundup', 'summary', 'preview',
  'review', 'guide', 'explainer', 'breakdown', 'profile', 'description', 'cartoon', 'cover',
  'coverage', 'source', 'media', 'journalism', 'journalist', 'reporter', 'correspondent', 'editor',
  'column', 'blog', 'post', 'wire', 'dispatch', 'bulletin', 'issue', 'edition', 'publication',
  'content', 'information', 'data', 'details', 'facts', 'figure', 'statistics', 'poll', 'survey',
  'quote', 'excerpt', 'image', 'photo', 'picture', 'video', 'audio', 'clip', 'document',
  
  // General words that don't provide specific content
  'amid', 'despite', 'following', 'according', 'regarding', 'concerning', 'instead', 'unless', 'while',
  'per', 'via', 'through', 'throughout', 'during', 'before', 'after', 'since', 'until', 'till',
  'among', 'between', 'within', 'without', 'around', 'across', 'along', 'beyond', 'above', 'below', 'under', 'over',
  'about', 'against', 'toward', 'towards', 'onto', 'into', 'out', 'off', 'up', 'down', 'away',
  'thing', 'things', 'stuff', 'lot', 'lots', 'kind', 'sort', 'type', 'way', 'ways', 'manner', 'form', 'aspect',
  'part', 'parts', 'piece', 'bit', 'section', 'area', 'item', 'items', 'case', 'cases', 'point', 'points',
  'example', 'examples', 'instance', 'instances', 'situation', 'context', 'background', 'result', 'results',
  'number', 'numbers', 'amount', 'level', 'rate', 'degree', 'percent', 'percentage', 'volume', 'measure',
  'group', 'groups', 'team', 'teams', 'side', 'sides', 'member', 'members', 'people', 'person', 'individual',
  'man', 'men', 'woman', 'women', 'child', 'children', 'family', 'families', 'community', 'public',
  'government', 'company', 'organization', 'agency', 'department', 'office', 'official', 'officials',
  'system', 'process', 'program', 'project', 'plan', 'effort', 'approach', 'method', 'strategy',
  'term', 'terms', 'word', 'words', 'name', 'names', 'title', 'titles', 'label', 'labels',
  'question', 'questions', 'answer', 'answers', 'issue', 'issues', 'problem', 'problems', 'challenge', 'challenges',
  'reason', 'reasons', 'cause', 'causes', 'effect', 'effects', 'impact', 'impacts', 'consequence', 'consequences',
  'change', 'changes', 'development', 'developments', 'trend', 'trends', 'pattern', 'patterns',
  'need', 'needs', 'role', 'roles', 'job', 'jobs', 'work', 'task', 'tasks',
  'place', 'places', 'location', 'locations', 'site', 'sites', 'country', 'countries', 'nation', 'nations',
  'state', 'states', 'city', 'cities', 'town', 'towns', 'region', 'regions', 'area', 'areas', 'world',
  'life', 'lives', 'death', 'deaths', 'event', 'events', 'incident', 'incidents', 'situation', 'situations',
  'home', 'house', 'building', 'school', 'hospital', 'car', 'vehicle', 'road', 'street',
  
  // High-frequency adjectives in news
  'new', 'old', 'top', 'bottom', 'big', 'small', 'large', 'little', 'major', 'minor',
  'key', 'important', 'unimportant', 'significant', 'insignificant', 'critical', 'noncritical',
  'essential', 'vital', 'crucial', 'main', 'primary', 'secondary', 'tertiary', 'notable',
  'recent', 'past', 'latest', 'earliest', 'current', 'former', 'previous', 'next', 'upcoming',
  'ongoing', 'developing', 'potential', 'possible', 'impossible', 'likely', 'unlikely', 'certain', 'uncertain',
  'controversial', 'uncontroversial', 'popular', 'unpopular', 'known', 'unknown', 'famous', 'infamous',
  'good', 'bad', 'better', 'worse', 'best', 'worst', 'great', 'poor', 'high', 'low', 'long', 'short',
  'early', 'late', 'quick', 'slow', 'easy', 'hard', 'difficult', 'simple', 'complex', 'clear', 'unclear',
  'true', 'false', 'real', 'fake', 'actual', 'virtual', 'right', 'wrong', 'correct', 'incorrect',
  'different', 'same', 'similar', 'various', 'several', 'multiple', 'single', 'double', 'triple',
  'many', 'few', 'much', 'less', 'more', 'most', 'least', 'enough', 'additional', 'extra',
  'full', 'empty', 'open', 'closed', 'public', 'private', 'common', 'rare', 'general', 'specific',
  'local', 'national', 'international', 'global', 'federal', 'state', 'political', 'economic', 'social',
  'financial', 'military', 'legal', 'medical', 'technical', 'official', 'personal', 'human',
  'dead', 'alive', 'available', 'unavailable', 'ready', 'prepared', 'related', 'unrelated',
  'serious', 'safe', 'dangerous', 'able', 'unable', 'concerned', 'aware', 'unaware', 'happy', 'sad',
  
  // High-frequency adverbs
  'also', 'just', 'very', 'really', 'well', 'even', 'still', 'too', 'yet', 'never', 'always',
  'often', 'sometimes', 'usually', 'generally', 'recently', 'currently', 'finally', 'already',
  'later', 'sooner', 'early', 'late', 'now', 'then', 'here', 'there', 'everywhere', 'nowhere',
  'back', 'forward', 'again', 'once', 'twice', 'first', 'secondly', 'thirdly', 'lastly',
  'together', 'apart', 'especially', 'particularly', 'specifically', 'clearly', 'obviously',
  'likely', 'probably', 'possibly', 'perhaps', 'maybe', 'actually', 'indeed', 'truly',
  'nearly', 'almost', 'about', 'around', 'roughly', 'approximately', 'exactly', 'precisely',
  'highly', 'largely', 'mainly', 'mostly', 'partly', 'fully', 'completely', 'entirely', 'totally',
  'quickly', 'slowly', 'easily', 'hardly', 'simply', 'directly', 'indirectly', 'effectively', 'successfully',
  'however', 'therefore', 'thus', 'hence', 'consequently', 'furthermore', 'moreover', 'meanwhile', 'instead',
  
  // Additional common news terms
  'first', 'second', 'third', 'fourth', 'fifth', 'last', 'next', 'previous', 'final', 'initial',
  
  // Title prefixes (already handled somewhat but reinforcing here)
  'president', 'vice', 'senator', 'rep', 'representative', 'secretary',
  'governor', 'mayor', 'chief', 'director', 'chairman', 'chairwoman',
  'spokesperson', 'minister', 'chancellor', 'prime', 'king', 'queen',
  'prince', 'princess', 'duke', 'duchess', 'sir', 'dame', 'ceo',
  'founder', 'official', 'leader', 'spokesman', 'spokeswoman', 'dr', 'prof', 'mr', 'mrs', 'ms'
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
  maxWords: number;
}

// Default configuration
export const DEFAULT_WORD_PROCESSING_CONFIG: WordProcessingConfig = {
  maxWords: 500,
};

/**
 * Processes news items to generate tag cloud words by aggregating pre-processed keywords from the backend.
 */
export const processNewsToWords = async (
  news: NewsItem[],
  config = DEFAULT_WORD_PROCESSING_CONFIG
): Promise<TagCloudWord[]> => {
  if (!news || news.length === 0) {
    return [];
  }

  // Create a map to track word occurrences and their biases
  const wordBiasMap = new Map<string, Map<PoliticalBias, number>>();
  const wordDataMap = new Map<string, {
    value: number;
    frequency: number;
    newsIds: string[];
    categories: Set<NewsCategory>;
  }>();

  // Process words into their respective bias categories
  news.forEach(item => {
    // Only need bias, keywords, url, id, category for processing here
    if (!item.source?.bias || !item.keywords || !item.url || !item.id || !item.category) return; 
    
    item.keywords.forEach(keyword => {
      // Normalize keyword (simple lowercase)
      const normalizedKeyword = keyword.toLowerCase().trim();
      // Skip empty keywords just in case
      if (!normalizedKeyword) return; 

      // Initialize or update word bias counts
      if (!wordBiasMap.has(normalizedKeyword)) {
        wordBiasMap.set(normalizedKeyword, new Map<PoliticalBias, number>());
      }
      const biasCount = wordBiasMap.get(normalizedKeyword)!;
      biasCount.set(item.source.bias, (biasCount.get(item.source.bias) || 0) + 1);

      // Update word data
      if (!wordDataMap.has(normalizedKeyword)) {
        wordDataMap.set(normalizedKeyword, {
          value: 0,
          frequency: 0,
          newsIds: [],
          categories: new Set<NewsCategory>()
        });
      }
      const wordData = wordDataMap.get(normalizedKeyword)!;
      wordData.value += 1; // Use frequency as value since TF-IDF is done in backend
      wordData.frequency += 1;
      if (!wordData.newsIds.includes(item.id)) {
        wordData.newsIds.push(item.id);
      }
      wordData.categories.add(item.category);
    });
  });

  // Convert word data to TagCloudWords with majority bias
  const words: TagCloudWord[] = [];
  for (const [key, biasCount] of Array.from(wordBiasMap.entries())) {
    const wordData = wordDataMap.get(key);
    if (!wordData) continue;

    // Find the bias with the highest count
    let maxCount = 0;
    let majorityBias = PoliticalBias.Unknown;
    for (const [bias, count] of Array.from(biasCount.entries())) {
      if (count > maxCount) {
        maxCount = count;
        majorityBias = bias;
      }
    }

    // Choose the most representative category
    const representativeCategory = wordData.categories.values().next().value || NewsCategory.News;

    words.push({
      text: key,
      value: wordData.value,
      bias: majorityBias,
      newsIds: wordData.newsIds,
      category: representativeCategory
    });
  }

  // Sort words by value in descending order
  words.sort((a, b) => b.value - a.value);

  // Apply max words limit
  return words.slice(0, config.maxWords);
};

/**
 * Utility function to analyze word frequency distribution
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