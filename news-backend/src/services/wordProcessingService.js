const natural = require('natural');
const nlp = require('compromise');
const { PoliticalBias } = require('../types'); // Import PoliticalBias from shared types
const { processArticleWithRetry } = require('./llmService'); // Import LLM service
const NewsItem = require('../models/NewsItem'); // <<< Import NewsItem model
const { lemmatizeWord, stripHtml, isProperNoun } = require('../utils/textUtils'); // <<< Import from textUtils

// In-memory cache for aggregated keywords
let aggregatedKeywordsCache = {
  timestamp: null,
  data: []
};
const CACHE_TTL_MS = 5 * 60 * 1000; // Cache for 5 minutes

// Counter for LLM fallbacks
let llmFallbackCount = 0;

// Function to get the current fallback count
const getLlmFallbackCount = () => {
  return llmFallbackCount;
};

// **Expanded and Merged Stop Words List**
// Combining basic English stop words, common news/descriptive/title words,
// and previously problematic single words ('here', 'shop', 'you', etc.)
const STOP_WORDS = new Set([
  // Basic English
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'this', 'but', 'they', 'have', 'had', 'what', 'when',
  'where', 'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'can', 'just', 'should', 'now', 'she', 'him', 'her',

  // Common Descriptive/Filler Words (from old frontend list & STOP_WORDS)
  // Common verbs, articles, prepositions, etc that don't add meaningful context in a tag cloud
  'get', 'got', 'getting', 'goes', 'going', 'gone', 'come', 'came', 'coming', 'make', 'made', 'making',
  'take', 'took', 'taking', 'put', 'puts', 'putting', 'set', 'setting', 'go', 'went', 'give', 'gave',
  'giving', 'run', 'ran', 'running', 'talk', 'talks', 'talking', 'tell', 'told', 'telling', 'call',
  'called', 'calling', 'use', 'used', 'using', 'ask', 'asked', 'asking', 'need', 'needed', 'needing',
  'want', 'wanted', 'wanting', 'try', 'tried', 'trying', 'feel', 'felt', 'feeling', 'become', 'became',
  'becoming', 'leave', 'left', 'leaving', 'may', 'might', 'must', 'could', 'would', 'should', 'shall',
  'said', 'says', 'do', 'does', 'did', 'doing', 'done', 'see', 'saw', 'seen', 'seeing', 'seem', 'seemed',
  'seeming', 'seems', 'look', 'looked', 'looking', 'looks', 'think', 'thought', 'thinking', 'thinks',
  'way', 'ways', 'thing', 'things', 'something', 'anything', 'everything', 'nothing', 'someone', 'anyone',
  'everyone', 'somebody', 'anybody', 'everybody', 'nobody', 'somewhere', 'anywhere', 'everywhere',
  'you', 'your', 'yours', 'yourself', 'yourselves', 'me', 'my', 'mine', 'myself', 'much', 'many',
  'us', 'we', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves',
  'here', 'there', 'where', 'get', 'gets', 'getting', 'let', 'lets', 'letting', 'able', 'non',
  'story', 'article', 'headline', 'update', 'news', 'latest', 'exclusive', 'interview', 'statement',
  'press', 'release', 'analysis', 'opinion', 'editorial', 'feature', 'briefing', 'recap',
  'roundup', 'summary', 'preview', 'review', 'guide', 'explainer', 'breakdown', 'profile',
  'description', 'cartoon', 'cover', 'coverage', 'source', 'media', 'journalism', 'journalist',
  'reporter', 'correspondent', 'editor', 'column', 'blog', 'post', 'wire', 'dispatch',
  'bulletin', 'issue', 'edition', 'publication', 'content', 'information', 'data', 'details',
  'facts', 'figure', 'statistics', 'poll', 'survey', 'quote', 'excerpt', 'image', 'photo',
  'picture', 'video', 'audio', 'clip', 'document', 'amid', 'despite', 'following', 'according',
  'regarding', 'concerning', 'instead', 'unless', 'while', 'per', 'via', 'through', 'throughout',
  'during', 'before', 'after', 'since', 'until', 'till', 'among', 'between', 'within', 'without',
  'around', 'across', 'along', 'beyond', 'above', 'below', 'under', 'over', 'about', 'against',
  'toward', 'towards', 'onto', 'into', 'out', 'off', 'up', 'down', 'away', 'thing', 'things',
  'stuff', 'lot', 'lots', 'kind', 'sort', 'type', 'way', 'ways', 'manner', 'form', 'aspect',
  'part', 'parts', 'piece', 'bit', 'section', 'area', 'item', 'items', 'case', 'cases', 'point',
  'points', 'example', 'examples', 'instance', 'instances', 'situation', 'context', 'background',
  'result', 'results', 'number', 'numbers', 'amount', 'level', 'rate', 'degree', 'percent',
  'percentage', 'volume', 'measure', 'group', 'groups', 'team', 'teams', 'side', 'sides',
  'member', 'members', 'people', 'person', 'individual', 'man', 'men', 'woman', 'women', 'child',
  'children', 'family', 'families', 'community', 'public', 'government', 'company', 'organization',
  'agency', 'department', 'office', 'official', 'officials', 'system', 'process', 'program',
  'project', 'plan', 'effort', 'approach', 'method', 'strategy', 'term', 'terms', 'word', 'words',
  'name', 'names', 'title', 'titles', 'label', 'labels', 'question', 'questions', 'answer',
  'answers', 'issue', 'issues', 'problem', 'problems', 'challenge', 'challenges', 'reason',
  'reasons', 'cause', 'causes', 'effect', 'effects', 'impact', 'impacts', 'consequence',
  'consequences', 'change', 'changes', 'development', 'developments', 'trend', 'trends',
  'pattern', 'patterns', 'role', 'roles', 'job', 'jobs', 'task', 'tasks',
  'place', 'places', 'location', 'locations', 'site', 'sites', 'country', 'countries', 'nation',
  'nations', 'state', 'states', 'city', 'cities', 'town', 'towns', 'region', 'regions', 'world',
  'life', 'lives', 'death', 'deaths', 'event', 'events', 'incident', 'incidents', 'situations',
  'home', 'house', 'building', 'school', 'hospital', 'car', 'vehicle', 'road', 'street',
  'new', 'old', 'top', 'bottom', 'big', 'small', 'large', 'little', 'major', 'minor', 'key',
  'important', 'unimportant', 'significant', 'insignificant', 'critical', 'noncritical', 'essential',
  'vital', 'crucial', 'main', 'primary', 'secondary', 'tertiary', 'notable', 'recent', 'past',
  'latest', 'earliest', 'current', 'former', 'previous', 'next', 'upcoming', 'ongoing', 'developing',
  'potential', 'possible', 'impossible', 'likely', 'unlikely', 'certain', 'uncertain',
  'controversial', 'uncontroversial', 'popular', 'unpopular', 'known', 'unknown', 'famous',
  'infamous', 'good', 'bad', 'better', 'worse', 'best', 'worst', 'great', 'poor', 'high', 'low',
  'long', 'short', 'early', 'late', 'quick', 'slow', 'easy', 'hard', 'difficult', 'simple',
  'complex', 'clear', 'unclear', 'true', 'false', 'real', 'fake', 'actual', 'virtual', 'right',
  'wrong', 'correct', 'incorrect', 'different', 'same', 'similar', 'various', 'several', 'multiple',
  'single', 'double', 'triple', 'many', 'few', 'much', 'less', 'most', 'least', 'enough',
  'additional', 'extra', 'full', 'empty', 'open', 'closed', 'public', 'private', 'common', 'rare',
  'general', 'specific', 'local', 'national', 'international', 'global', 'federal', 'state',
  'political', 'economic', 'social', 'financial', 'military', 'legal', 'medical', 'technical',
  'official', 'personal', 'human', 'dead', 'alive', 'available', 'unavailable', 'ready', 'prepared',
  'related', 'unrelated', 'serious', 'safe', 'dangerous', 'able', 'unable', 'concerned', 'aware',
  'unaware', 'happy', 'sad', 'also', 'just', 'very', 'really', 'well', 'even', 'still', 'too',
  'yet', 'never', 'always', 'often', 'sometimes', 'usually', 'generally', 'recently', 'currently',
  'finally', 'already', 'later', 'sooner', 'early', 'late', 'now', 'then', 'here', 'there',
  'everywhere', 'nowhere', 'back', 'forward', 'again', 'once', 'twice', 'first', 'secondly',
  'thirdly', 'lastly', 'together', 'apart', 'especially', 'particularly', 'specifically',
  'clearly', 'obviously', 'likely', 'probably', 'possibly', 'perhaps', 'maybe', 'actually',
  'indeed', 'truly', 'nearly', 'almost', 'about', 'around', 'roughly', 'approximately', 'exactly',
  'precisely', 'highly', 'largely', 'mainly', 'mostly', 'partly', 'fully', 'completely', 'entirely',
  'totally', 'quickly', 'slowly', 'easily', 'hardly', 'simply', 'directly', 'indirectly',
  'effectively', 'successfully', 'however', 'therefore', 'thus', 'hence', 'consequently',
  'furthermore', 'moreover', 'meanwhile', 'instead', 'first', 'second', 'third', 'fourth', 'fifth',
  'last', 'next', 'previous', 'final', 'initial', 'president', 'vice', 'senator', 'rep',
  'representative', 'secretary', 'governor', 'mayor', 'chief', 'director', 'chairman', 'chairwoman',
  'spokesperson', 'minister', 'chancellor', 'prime', 'king', 'queen', 'prince', 'princess', 'duke',
  'duchess', 'sir', 'dame', 'ceo', 'founder', 'official', 'leader', 'spokesman', 'spokeswoman',
  'dr', 'prof', 'mr', 'mrs', 'ms', 'world', 'us', 'politics', 'opinion', 'editorial', 'business',
  'finance', 'money', 'economy', 'markets', 'technology', 'tech', 'science', 'health', 'sports',
  'arts', 'culture', 'entertainment', 'style', 'fashion', 'travel', 'food', 'dining', 'real estate',
  'home', 'education', 'books', 'obituaries', 'weather', 'local', 'metro', 'national', 'international',
  'magazine', 'weekend', 'sunday', 'columns', 'features', 'lifestyle', 'society', 'law', 'crime',
  'justice', 'environment', 'jobs', 'careers', 'autos', 'cars', 'classifieds', 'events', 'calendar',
  'letters', 'comics', 'puzzles', 'games', 'horoscopes', 'crosswords', 'photos', 'video',
  'multimedia', 'podcast', 'audio', 'gallery', 'slideshow', 'infographic', 'advertisement',
  'sponsored', 'subscription', 'subscribe', 'donate', 'support', 'contact', 'about', 'staff',
  'corrections', 'archives', 'reduce', 'save', 'shop', 'accord', 'deal', 'issue', 'order',
  'want', 'call', 'file', 'find', 'lose', 'make', 'write', 'help', 'set', 'need', // Included 'need'
  "you're", "you", // Included 'you' and variants
  // Explicitly add words from ALWAYS_FILTER_WORDS (if not already present)
  'here',

  // Time-related (ensure comprehensive)
  'today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'day', 'hour', 'minute', 'second',
  'morning', 'afternoon', 'evening', 'night', 'midnight', 'noon', 'daily', 'weekly', 'monthly', 'annual', 'biannual',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'date', 'time', 'period', 'season', 'era', 'century', 'decade', 'moment', 'schedule',

  // Verbs (ensure comprehensive)
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
]);

// Words that might be meaningful in news context despite being stop words
// (Keep this separate to allow specific stop words if they are news-relevant)
const NEWS_SPECIFIC_WORDS = new Set([
  'breaking', 'exclusive', 'update', 'live', 'developing', 'urgent' // Note: some are already in STOP_WORDS but NEWS_SPECIFIC takes precedence
]);

// Comprehensive list of news source names derived from rssService.js
const NEWS_SOURCE_NAMES = new Set([
  'aba', 'abc', 'above', 'ai', 'al', 'all', 'analytics', 'ap', 'ars', 'art', 'artforum', 'artnet', 'artnews', 'artsy',
  'astronomy', 'axios', 'bazaar', 'bbc', 'beast', 'billboard', 'bleacher', 'bloomberg', 'bof', 'boing', 'breitbart',
  'business', 'buzzfeed', 'caller', 'cbn', 'cbs', 'cdc', 'central', 'christian', 'climate', 'cnet', 'cnn', 'colossal',
  'consequence', 'conservative', 'cut', 'daily', 'deadline', 'deadspin', 'deepmind', 'democracy', 'department',
  'dispatch', 'discover', 'drudge', 'e', 'earth', 'economist', 'elle', 'engadget', 'entertainment', 'environmental',
  'epa', 'epoch', 'esa', 'espn', 'examiner', 'fashion', 'federalist', 'financial', 'findlaw', 'forbes', 'fox',
  'free', 'frieze', 'ft', 'gq', 'gizmodo', 'google', 'grayzone', 'grist', 'ground', 'guardian', "harper's", 'harvard',
  'health', 'healthline', 'herald', 'highsnobiety', 'hill', 'hollywood', 'huffpost', 'hypebeast', 'hyperallergic',
  'ign', 'ijr', 'independent', 'insider', 'insideclimate', 'intercept', 'jacobin', 'jazeera', 'journal', 'jr',
  'jurist', 'just', 'justia', 'juxtapoz', 'kaiser', 'kdnuggets', 'khn', 'kotaku', 'law', 'law360', 'lifehacker', 'live',
  'mail', 'magazine', 'marketwatch', 'mashable', 'mastery', 'mayo', 'medical', 'medscape', 'meme', 'mit', 'mixmag',
  'mongabay', 'monitor', 'mother', 'msnbc', 'music', 'nasa', 'nation', 'national', 'nature', 'nbc', 'new', 'news',
  'newsnation', 'newsweek', 'nih', 'nme', 'now', 'npr', 'ny', 'nyt', 'observed', 'onion', 'openai',
  'pbs', 'pc', 'people', 'phys', 'pitchfork', 'planetary', 'politico', 'polygon', 'popular', 'post',
  'propublica', 'publishing', 'quanta', 'reason', 'recode', 'refinery29', 'releases', 'report', 'reporter', 'republic',
  'resident', 'reuters', 'review', 'rolling', 'science', 'sciam', 'scotusblog',
  'semafor', 'si', 'signal', 'sky', 'slate', 'smithsonian', 'socialist', 'society', 'sound', 'space', 'spacenews',
  'spectator', 'sports', 'stat', 'stereogum', 'stone', 'straight', 'street', 'süddeutsche', 'tech', 'techcrunch',
  'techdirt', 'techmeme', 'technica', 'technology', 'telescope', 'the', 'thinkprogress', 'time', 'times', 'tmz', 'today',
  "tom's", 'towards', 'treehugger', 'truthout', 'un', 'universe', 'usa', 'variety', 'venturebeat', 'verge', 'vidhya',
  'vice', 'vogue', 'volokh', 'vox', 'vulture', 'wall', 'washington', 'watch', 'wd', 'webmd', 'weekly', 'who', 'wired',
  'wire', 'world', 'wsj', 'wsws', 'wwd', 'yahoo', 'yale', 'yorker', 'zdnet', 'zeitung', 'zerohedge', 'francisco',
  'chronicle', 'inquirer', 'tribune', 'bee', 'diego', 'union-tribune', 'star-ledger', 'oregonian', 'pioneer', 'press',
  'mercury', 'globe', 'denver', 'star', 'cleveland', 'plain', 'dealer', 'arizona', 'republic', 'kansas', 'city'
  // ... rest of the list ...
]);

// Global configuration with defaults
const DEFAULT_CONFIG = {
  minWordLength: 2,  // Reduced to allow more short words
  maxWordLength: 40, // Increased to allow longer phrases
  minPhraseWords: 2, // Minimum words for a phrase to be kept
  maxPhraseWords: 5, // Increased to allow longer phrases
  removeStopWords: true,  // Filter out common stop words
  useStemming: false,     // Use stemming (disabled because it can create confusing output)
  useLemmatization: true, // Use lemmatization for better normalization
  minTfIdfScore: 0.001,   // Significantly reduced to allow many more terms
  extractNounPhrases: true, // Extract noun phrases for better multi-word entities
  maxWords: 1500 // Increased from default to allow more words in the cloud
};

// Add more descriptive words that should be kept even if they're in stop words
const IMPORTANT_DESCRIPTIVE_WORDS = new Set([
  'major', 'critical', 'breaking', 'exclusive', 'urgent', 'developing',
  'investigation', 'analysis', 'report', 'update', 'crisis', 'emergency',
  'breakthrough', 'discovery', 'controversy', 'scandal', 'reform',
  'initiative', 'proposal', 'decision', 'agreement', 'conflict',
  'resolution', 'victory', 'defeat', 'success', 'failure', 'impact',
  'threat', 'risk', 'benefit', 'challenge', 'opportunity', 'progress',
  'decline', 'increase', 'decrease', 'growth', 'reduction', 'expansion',
  'collapse', 'recovery', 'revolution', 'transformation', 'innovation'
]);

/**
 * Extracts meaningful phrases using NLP
 * Prioritizes named entities and important news constructions
 */
const extractMeaningfulPhrases = (text) => {
  const doc = nlp(text);
  const phrases = [];

  // Extract named entities - people (prioritize names of people)
  doc.match('#Person+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.length >= 3 && phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.5 }); // Higher weight for people's names
    }
  });

  // Extract organizations and companies
  doc.match('#Organization+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.length >= 2 && phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.4 }); // Higher weight for organizations
    }
  });

  // Extract locations
  doc.match('#Place+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.length >= 2 && phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.3 }); // Higher weight for places
    }
  });

  // Extract topics and issues (noun phrases with adjectives)
  doc.match('#Adjective+ #Noun+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.split(' ').length >= DEFAULT_CONFIG.minPhraseWords &&
        phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.0 });
    }
  });

  // Extract active events (verb phrases)
  doc.match('#Noun+ #Verb+ #Noun+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.split(' ').length >= DEFAULT_CONFIG.minPhraseWords &&
        phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.1 }); // Slightly higher weight for actions
    }
  });
  
  // Extract special patterns that often indicate newsworthy events
  // E.g., "President announces", "Supreme Court rules"
  doc.match('(president|minister|official|court|government|senate|congress|police|military|forces) #Verb+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.split(' ').length >= 2 && phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.5 }); // Higher weight for official actions
    }
  });

  return phrases;
};

/**
 * Determines if a word/phrase should be kept for the tag cloud
 * Simplified filtering logic to focus on meaningful, informative words/phrases
 * while avoiding redundancy and excessive filtering
 */
const shouldKeepWord = (phrase, config) => {
  // Remove HTML and check if anything remains
  const cleanPhrase = stripHtml(phrase);
  if (!cleanPhrase) return false;
  
  const lowerPhrase = cleanPhrase.toLowerCase();
  const words = lowerPhrase.split(/\s+/).filter(w => w.length > 0);
  
  // Quick length validation
  if (words.length === 0) return false;
  
  // Always keep important descriptive words
  if (IMPORTANT_DESCRIPTIVE_WORDS.has(lowerPhrase)) {
    return true;
  }

  // ==== STAGE 1: Quick rejects (fast pattern matching) ====
  
  // Reject obvious HTML/URL elements that shouldn't be in a word cloud
  if (lowerPhrase.includes('href=') || 
      lowerPhrase.includes('src=') ||
      lowerPhrase.includes('http:') ||
      lowerPhrase.includes('https:') ||
      lowerPhrase.includes('www.') ||
      lowerPhrase.includes('@') ||
      lowerPhrase.includes('...')) {
    return false;
  }
  
  // Reject UI navigation text that shouldn't be in a news tag cloud
  if (lowerPhrase.includes('continue reading') ||
      lowerPhrase.includes('read more') ||
      lowerPhrase.includes('sign in') ||
      lowerPhrase.includes('sign up') ||
      lowerPhrase.includes('subscribe') ||
      lowerPhrase.includes('click here') ||
      lowerPhrase.includes('tap here')) {
    return false;
  }
  
  // Reject code-like patterns
  if (lowerPhrase.includes('function') || 
      lowerPhrase.includes('var ') ||
      lowerPhrase.includes('const ') ||
      lowerPhrase.includes('class ') ||
      lowerPhrase.includes('javascript')) {
    return false;
  }

  // ==== STAGE 2: Handle differently based on phrase length ====
  
  // Single word handling
  if (words.length === 1) {
    const word = words[0];
    
    // Keep proper nouns regardless of other rules
    if (isProperNoun(word)) {
      return true;
    }
    
    // Basic length validation
    if (word.length < config.minWordLength || word.length > config.maxWordLength) {
      return false;
    }
    
    // Reject just numbers, single letters, or codes like a1, b2
    if (/^\d+$/.test(word) || /^[a-z]$/.test(word) || /^[a-z]\d+$/.test(word)) {
      return false;
    }
    
    // Reject news source names to avoid them dominating the cloud
    if (NEWS_SOURCE_NAMES.has(word)) {
      return false;
    }
    
    // Remove stop words unless they're news-specific
    if (config.removeStopWords && STOP_WORDS.has(word) && !NEWS_SPECIFIC_WORDS.has(word)) {
      return false;
    }
    
    // Require at least one letter (not just symbols or numbers)
    return /[a-zA-Z]/.test(word);
  } 
  
  // Multi-word phrase handling
  else {
    // Validate phrase length
    if (words.length < config.minPhraseWords || words.length > config.maxPhraseWords) {
      return false;
    }
    
    // Reject phrases with meaningless prefixes/suffixes
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    
    const meaninglessPrefixes = ['a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'am', 'is', 'are', 'was', 'were', 'be', 'been'];
    const meaninglessSuffixes = ['etc', 'so', 'to', 'for', 'of', 'by', 'with', 'in', 'on', 'at'];
    
    if (meaninglessPrefixes.includes(firstWord) && words.length <= 2) {
      return false;
    }
    
    if (meaninglessSuffixes.includes(lastWord) && words.length <= 2) {
      return false;
    }
    
    // For 2-word phrases, require at least one non-stop word or proper noun
    if (words.length === 2) {
      return words.some(w => !STOP_WORDS.has(w) || isProperNoun(w) || NEWS_SPECIFIC_WORDS.has(w));
    }
    
    // For 3+ word phrases, they're likely meaningful, so keep them
    // unless they're composed entirely of stop words
    return !words.every(w => STOP_WORDS.has(w) && !NEWS_SPECIFIC_WORDS.has(w) && !isProperNoun(w));
  }
};

/**
 * Processes news items to generate refined keywords using LLM and NLP techniques
 * @param {Array<Object>} newsItems - Array of news item objects
 * @param {Object} config - Configuration options
 * @returns {Promise<Array<object>>} An array of objects, each containing the original ID, bias, and keywords.
 */
async function processNewsKeywords(newsItems, config = DEFAULT_CONFIG) {
  console.log(`[WordProcessingService] Starting keyword processing for ${newsItems.length} items.`);
  const MAX_CONCURRENT_LLM_REQUESTS = 5; // Limit concurrency to avoid overwhelming LLM

  // Use a library like 'p-limit' or a simple semaphore pattern if needed for more robust concurrency control.
  // For now, a simple Promise.all with map is used, relying on the queue's concurrency.

  const processedResults = await Promise.allSettled(newsItems.map(async (item) => {
    // Ensure item has the necessary fields before processing, be lenient on content
    if (!item || !item.minifluxEntryId || !item.title || typeof item.content !== 'string') {
        console.warn(`[WordProcessingService] Skipping item due to missing fields (minifluxEntryId, title, or content type check failed):`, item);
        // Return a specific structure indicating failure for this item
        return { 
            status: 'rejected', 
            reason: 'Missing required fields', 
            minifluxEntryId: item?.minifluxEntryId || 'unknown' // Include ID if possible
        };
    }

    try {
      // Extract title and first sentence (or use content snippet if no sentence structure)
      const title = item.title;
      // Basic first sentence extraction (improve if needed)
      const firstSentenceMatch = item.content.match(/^[^.!?]+[.!?]/);
      const firstSentence = firstSentenceMatch ? firstSentenceMatch[0] : item.content.substring(0, 150);

      // Call LLM service - processArticleWithRetry handles retries internally
      const llmResult = await processArticleWithRetry(title, firstSentence);
      
      // --- Combine LLM result with original item identifiers --- 
      const finalResult = {
          ...llmResult, // Should contain { bias, keywords }
          minifluxEntryId: item.minifluxEntryId, // Add the ID back!
          llmProcessingAttempts: item.llmProcessingAttempts // Keep track of attempts
          // Add any other fields needed by the task_finish handler
      };
      
      console.log(`[WordProcessingService] LLM Result for item ${finalResult.minifluxEntryId}:`, JSON.stringify(finalResult));
      
      return { status: 'fulfilled', value: finalResult }; // Wrap in settled structure

    } catch (error) {
      console.error(`[WordProcessingService] Error processing item ${item.minifluxEntryId} with LLM:`, error);
      llmFallbackCount++; // Increment fallback counter on error
      // Return detailed error structure
      return { 
          status: 'rejected', 
          reason: error.message || 'Unknown processing error', 
          minifluxEntryId: item.minifluxEntryId, // Include ID
          llmProcessingAttempts: item.llmProcessingAttempts // Keep track of attempts
       };
    }
  }));

  // Filter out rejected promises and extract the successful results
  const successfulResults = processedResults
    .filter(result => result.status === 'fulfilled' && result.value)
    .map(result => result.value);
    
  // Log errors for rejected promises
  processedResults
    .filter(result => result.status === 'rejected')
    .forEach(result => {
        console.error(`[WordProcessingService] Failed processing item ${result.minifluxEntryId || 'unknown'}: ${result.reason}`);
        // Potentially update the DB item to mark the error and increment attempts here
        // This might be better handled in the task_finish handler based on the result structure
    });

  console.log(`[WordProcessingService] Finished keyword processing. Successful: ${successfulResults.length}, Failed: ${processedResults.length - successfulResults.length}`);
  return successfulResults; // Return only successfully processed items
}

/**
 * Aggregates keywords from a list of news items for the tag cloud.
 * Calculates frequency counts for each keyword, with bias information.
 * Enhanced to prioritize multi-word phrases for better storytelling.
 *
 * @param {Array<Object>} newsItems - Array of news item objects, each expected to have a `keywords` array field.
 * @param {number} maxWords - The maximum number of words to return for the cloud.
 * @returns {Array<{text: string, value: number, bias: PoliticalBias, category: string}>} - Array of objects for the tag cloud, including bias and category.
 */
function aggregateKeywordsForCloud(newsItems, maxWords = 1000) {
  if (!newsItems || newsItems.length === 0) {
    return [];
  }

  const wordData = new Map();
  console.log(`[aggregateKeywordsForCloud] Starting aggregation for ${newsItems?.length} items.`);

  if (newsItems && newsItems.length > 0) {
    console.log('[aggregateKeywordsForCloud] Inspecting first news item for aggregation:', JSON.stringify(newsItems[0], (key, value) => key === 'content' || key === 'description' ? '[TRUNCATED]' : value, 2));
  }

  newsItems.forEach((item, index) => {
    // Ensure bias exists, default to Unknown if not. Read from item.bias directly.
    const itemBias = item.bias || PoliticalBias.Unknown;
    const itemCategory = item.source?.category || 'UNKNOWN'; // <<< Get item category, default to UNKNOWN
    if (!item.bias) { // Check item.bias directly
      console.warn(`Item is missing bias information: ${item.id || 'N/A'}`);
    }

    if (item.keywords && Array.isArray(item.keywords)) {
      // Log keywords for the current item
      if (index < 5) { // Log first 5 items' keywords to avoid excessive logging
        console.log(`[aggregateKeywordsForCloud] Processing item ${index} (ID: ${item.id}) keywords:`, JSON.stringify(item.keywords));
      }

      // Process each keyword from this item
      item.keywords.forEach(keyword => {
        // Check if keyword is an object with a 'text' property, or just a string
        const keywordText = typeof keyword === 'object' && keyword !== null && typeof keyword.text === 'string'
                          ? keyword.text
                          : typeof keyword === 'string' ? keyword : null;

        if (keywordText) { // Proceed if we extracted a valid string
          // Clean and normalize the keyword
          const cleanKeyword = stripHtml(keywordText);
          if (!cleanKeyword || cleanKeyword.length < 2) return; // Skip empty or very short keywords

          const keywordKey = cleanKeyword.trim(); // Use original casing as key

          // Skip keywords that contain problematic patterns (simplified check to allow more words)
          if (keywordKey.toLowerCase().includes('href=') || // Check lowercase for patterns
              keywordKey.toLowerCase().includes('src=') ||
              keywordKey.toLowerCase().includes('http:') ||
              keywordKey.toLowerCase().includes('https:')) {
            return;
          }

          // Add or update the keyword in our map
          if (!wordData.has(keywordKey)) { // Use original casing key
            // First time seeing this keyword, store its data
            wordData.set(keywordKey, { // Use original casing key
              value: 1, // Raw frequency count
              bias: itemBias, // Assign initial bias
              biasCounts: { [itemBias]: 1 }, // Track bias occurrences
              category: itemCategory, // <<< Assign initial category
              categoryCounts: { [itemCategory]: 1 }, // <<< Track category occurrences
              // <<< Track unique documents and sources >>>
              docIds: new Set([item.id || item.minifluxEntryId]), // Use item ID or Miniflux ID
              sourceNames: new Set([item.source?.name].filter(Boolean)) // Track source names
            });
          } else {
            // Already seen, update counts and bias tracking
            const currentData = wordData.get(keywordKey); // Use original casing key
            currentData.value += 1; // Increment raw frequency

            // <<< Add current doc ID and source name >>>
            currentData.docIds.add(item.id || item.minifluxEntryId);
            if (item.source?.name) {
              currentData.sourceNames.add(item.source.name);
            }

            // Update bias tracking
            if (!currentData.biasCounts[itemBias]) {
              currentData.biasCounts[itemBias] = 1;
            } else {
              currentData.biasCounts[itemBias] += 1;
            }
            
            // <<< Update category tracking >>>
            if (!currentData.categoryCounts[itemCategory]) {
              currentData.categoryCounts[itemCategory] = 1;
            } else {
              currentData.categoryCounts[itemCategory] += 1;
            }

            // Recalculate dominant bias
            let maxBiasCount = 0;
            let dominantBias = currentData.bias;
            Object.entries(currentData.biasCounts).forEach(([bias, count]) => {
              if (count > maxBiasCount) {
                maxBiasCount = count;
                dominantBias = bias;
              }
            });
            currentData.bias = dominantBias;
            
            // <<< Recalculate dominant category >>>
            let maxCategoryCount = 0;
            let dominantCategory = currentData.category;
            Object.entries(currentData.categoryCounts).forEach(([category, count]) => {
              if (count > maxCategoryCount) {
                maxCategoryCount = count;
                dominantCategory = category;
              }
            });
            currentData.category = dominantCategory;
          }
        }
      });
    }
  });

  // Log the size of wordData after processing all items and before filtering
  console.log(`[aggregateKeywordsForCloud] Initial wordData map size before filtering: ${wordData.size}`);

  let filteredOutCount = 0;
  const initialKeywordArrayForFiltering = Array.from(wordData.entries()).map(([text, data]) => {
    const docCount = data.docIds.size;
    return { text, value: data.value * Math.log10(1.1 + docCount), rawValue: data.value, docCount, sourceCount: data.sourceNames.size, bias: data.bias, category: data.category };
  });

  const mappedKeywords = initialKeywordArrayForFiltering
    .filter(item => {
      const originalText = item.text;
      // --- Filtering Stage ---
      if (!item.text) {
        console.log(`[aggregateKeywordsForCloud FILTERING] Out: Empty text. Original: ${originalText}`);
        filteredOutCount++;
        return false;
      }

      const lowerText = item.text.toLowerCase();
      const words = item.text.split(' ');
      const wordCount = words.length;

      const containsSource = words.some(word => NEWS_SOURCE_NAMES.has(word.toLowerCase()));
      if (containsSource) {
        if (filteredOutCount < 10) console.log(`[aggregateKeywordsForCloud FILTERING] Out: Contains source name. Original: ${originalText}`);
        filteredOutCount++;
        return false;
      }

      if (/&#\d+;/.test(item.text) || /&[a-zA-Z]+;/.test(item.text)) {
        if (filteredOutCount < 10) console.log(`[aggregateKeywordsForCloud FILTERING] Out: HTML entity. Original: ${originalText}`);
        filteredOutCount++;
        return false;
      }

      if (wordCount < 1 || wordCount > 5) {
        if (filteredOutCount < 10) console.log(`[aggregateKeywordsForCloud FILTERING] Out: Word count (${wordCount}). Original: ${originalText}`);
        filteredOutCount++;
        return false;
      }

      if (item.text.length < 2 || item.text.length > 50) {
        if (filteredOutCount < 10) console.log(`[aggregateKeywordsForCloud FILTERING] Out: Text length (${item.text.length}). Original: ${originalText}`);
        filteredOutCount++;
        return false;
      }

      if (wordCount > 1 && words.every(w => STOP_WORDS.has(w.toLowerCase()))) {
        if (filteredOutCount < 10) console.log(`[aggregateKeywordsForCloud FILTERING] Out: All stop words. Original: ${originalText}`);
        filteredOutCount++;
        return false;
      }
      return true;
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, maxWords);
  console.log(`[aggregateKeywordsForCloud] Total keywords filtered out: ${filteredOutCount}`);
  console.log(`[aggregateKeywordsForCloud] Aggregated ${mappedKeywords.length} unique keywords with bias from ${newsItems.length} items.`);
  return mappedKeywords;
}

/**
 * Combine keywords from LLM and traditional NLP processing
 * Strongly prioritizes LLM multi-word phrases while preserving high-value traditional keywords
 * @param {Array<Object>} llmKeywords - Keywords from LLM
 * @param {Array<Object>} traditionalKeywords - Keywords from traditional NLP
 * @returns {Array<Object>} - Combined keywords
 */
function combineKeywords(llmKeywords, traditionalKeywords) {
  // Create a set from LLM keywords for quick lookup
  // Add extra filter for robustness, ensuring only strings are mapped
  const llmKeywordSet = new Set(llmKeywords.filter(k => typeof k === 'string').map(k => k.toLowerCase()));
  
  // Filter traditional keywords to only keep those not already in LLM keywords
  // and prioritize high-value multi-word phrases from traditional method
  const uniqueTraditionalKeywords = traditionalKeywords
    .filter(k => !llmKeywordSet.has(k.text.toLowerCase()))
    // Prioritize traditional multi-word entities
    .map(keyword => {
      const wordCount = keyword.text.split(/\s+/).length;
      // For traditional keywords, only keep multi-words with good weight
      // or single words with high weight (indicating importance)
      const isMultiWord = wordCount > 1;
      const isHighValue = keyword.value > 1.3;
      
      // Boost multi-word phrases from traditional NLP
      if (isMultiWord) {
        return {
          ...keyword,
          value: keyword.value * 1.2 // 20% boost for multi-word phrases
        };
      }
      
      // Slightly reduce weight of single words to favor phrases
      if (!isMultiWord && !isHighValue) {
        return {
          ...keyword,
          value: keyword.value * 0.8 // 20% reduction for single words
        };
      }
      
      return keyword;
    })
    // For traditional keywords, prioritize phrases more strongly
    .sort((a, b) => {
      const aWords = a.text.split(/\s+/).length;
      const bWords = b.text.split(/\s+/).length;
      // Sort by word count (descending) then by value (descending)
      return (bWords - aWords) || (b.value - a.value);
    })
    // Limit the number of traditional keywords to prevent overwhelming the LLM ones
    .slice(0, Math.min(llmKeywords.length, 30));
  
  // Combine, strongly prioritizing LLM keywords (they come first in the array)
  return [...llmKeywords, ...uniqueTraditionalKeywords];
}

// <<< New Function: cacheAggregatedKeywords >>>
/**
 * Fetches recently processed news items, aggregates keywords, and caches the result.
 */
async function cacheAggregatedKeywords() {
  console.log('[WordProcessingService] Starting keyword aggregation cache update...');
  try {
    const lookbackMinutes = 240;
    const cutoffDate = new Date(Date.now() - lookbackMinutes * 60 * 1000);

    const recentItems = await NewsItem.find({
      llmProcessed: true,
      updatedAt: { $gte: cutoffDate },
      'keywords.0': { $exists: true }
    }).lean();

    if (!recentItems || recentItems.length === 0) {
      console.log('[WordProcessingService] No recently processed items found to update keyword cache within the last ' + lookbackMinutes + ' minutes.');
      return;
    }

    console.log(`[WordProcessingService] Found ${recentItems.length} recent items for cache aggregation. Inspecting first few (up to 2):`);
    // Log the first 2 items fetched, showing crucial fields like keywords, llmProcessed, updatedAt
    for (let i = 0; i < Math.min(recentItems.length, 2); i++) {
      const item = recentItems[i];
      console.log(`[WordProcessingService] Item ${i + 1} for cache: id=${item._id}, minifluxEntryId=${item.minifluxEntryId}, llmProcessed=${item.llmProcessed}, updatedAt=${item.updatedAt}, keywords=${JSON.stringify(item.keywords)}, bias=${item.bias}, category=${item.category}`);
    }

    const aggregatedData = aggregateKeywordsForCloud(recentItems, 1000);

    // Update the cache
    aggregatedKeywordsCache = {
      timestamp: new Date(),
      data: aggregatedData
    };

    console.log(`[WordProcessingService] Keyword cache updated successfully with ${aggregatedData.length} keywords at ${aggregatedKeywordsCache.timestamp.toISOString()}.`);

  } catch (error) {
    console.error('[WordProcessingService] Error updating keyword aggregation cache:', error);
  }
}

// <<< New Function: getCachedAggregatedKeywords >>>
/**
 * Returns the cached aggregated keywords if available and not stale.
 */
function getCachedAggregatedKeywords() {
  const now = Date.now();
  if (aggregatedKeywordsCache.timestamp && (now - aggregatedKeywordsCache.timestamp.getTime() < CACHE_TTL_MS) && aggregatedKeywordsCache.data.length > 0) {
    console.log(`[WordProcessingService] Serving ${aggregatedKeywordsCache.data.length} keywords from cache (timestamp: ${aggregatedKeywordsCache.timestamp.toISOString()}).`);
    return aggregatedKeywordsCache.data;
  } else {
    console.log('[WordProcessingService] Cache miss or stale. No cached keywords served.');
    // Optionally trigger an immediate update if cache is stale?
    // cacheAggregatedKeywords(); // Be careful with async calls here
    return null; // Indicate cache miss
  }
}

module.exports = {
  processNewsKeywords,
  aggregateKeywordsForCloud,
  cacheAggregatedKeywords, // <<< Export new function
  getCachedAggregatedKeywords, // <<< Export new getter
  getLlmFallbackCount, // Export the getter function
  DEFAULT_CONFIG,
  combineKeywords, // Ensure existing exports remain
  stripHtml, 
  shouldKeepWord,
  extractMeaningfulPhrases,
  isProperNoun,
  lemmatizeWord
}; 