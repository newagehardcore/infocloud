const natural = require('natural');
const nlp = require('compromise');
// const { PoliticalBias } = require('../utils/biasAnalyzer'); // Old import
const { PoliticalBias } = require('../types'); // Import PoliticalBias from shared types

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
 * Lemmatizes a word using the compromise library
 */
const lemmatizeWord = (word) => {
  if (!word || word.length === 0) return word;
  let originalWord = word; // Keep original for logging
  try {
    const lowerWord = word.toLowerCase();
    const doc = nlp(lowerWord);
    const termsData = doc.json({ terms: { normal: true, text: true } });
    const normalizedTerms = termsData[0]?.terms.map(t => t.normal || t.text) || [];
    const result = normalizedTerms.join(' ').trim();
    // ** Log input and output (UNCOMMENTED) **
    console.log(`[LemmaDebug] Input: "${originalWord}", Output: "${result || '(empty)'}"`); 
    return result;
  } catch (error) {
    console.warn(`[WordProcessing] Error lemmatizing "${word}":`, error);
    return word.toLowerCase();
  }
};

/**
 * Detects if a string is likely a proper noun (name, place, organization)
 */
const isProperNoun = (text) => {
  const doc = nlp(text);
  return doc.match('#ProperNoun').found;
};

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
 * Strip HTML tags from text
 * @param {string} text - The text containing HTML to strip
 * @returns {string} - Clean text without HTML tags
 */
const stripHtml = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  // First remove script and style tags with their content
  let clean = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  
  // Then remove all HTML tags
  clean = clean.replace(/<\/?[^>]+(>|$)/g, ' ');
  
  // Replace HTML entities
  clean = clean.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");
  
  // Replace multiple spaces with a single space
  clean = clean.replace(/\s+/g, ' ').trim();
  
  return clean;
};

/**
 * Determines if a word should be kept based on configuration and filter lists
 * Enhanced to better filter out low-quality words while preserving meaningful ones
 */
const shouldKeepWord = (phrase, config) => {
  // First strip any HTML from the phrase
  const cleanPhrase = stripHtml(phrase);
  if (!cleanPhrase) return false;
  
  const lowerPhrase = cleanPhrase.toLowerCase();
  
  // Always keep important descriptive words
  if (IMPORTANT_DESCRIPTIVE_WORDS.has(lowerPhrase)) {
    return true;
  }

  // Block problematic patterns and common non-meaningful patterns
  if (/^\d+$/.test(cleanPhrase) || // Just numbers
      /^[a-z]{1,2}$/.test(lowerPhrase) || // Single or two letters (like 'am', 're', 'if', 'or', 'vs')
      /^[a-z]{1,2}\d+$/.test(lowerPhrase) || // Short code like a1, b2, etc
      lowerPhrase.includes('href=') || 
      lowerPhrase.includes('src=') ||
      lowerPhrase.includes('http:') ||
      lowerPhrase.includes('https:') ||
      lowerPhrase.includes('www.') ||
      lowerPhrase.includes('@') ||
      lowerPhrase.includes('...') ||
      // Filter common UI elements and navigation text
      lowerPhrase.includes('skip') ||
      lowerPhrase.includes('advertisement') ||
      lowerPhrase.includes('login') ||
      lowerPhrase.includes('verify') ||
      lowerPhrase.includes('access') ||
      lowerPhrase.includes('click') ||
      lowerPhrase.includes('continue reading') ||
      lowerPhrase.includes('read more') ||
      lowerPhrase.includes('sign in') ||
      lowerPhrase.includes('sign up') ||
      lowerPhrase.includes('subscribe') ||
      // Common meaningless prefixes
      /^(am|is|are|was|were|be|been|being|ve|ll|re|not|no)\s/.test(lowerPhrase) ||
      // Common meaningless suffixes
      /\s(am|is|are|was|were|ll|ve|re|vs|etc|or|if)$/.test(lowerPhrase)) {
    return false;
  }

  // Additional filtering for common low-quality patterns
  // Filter out words that are likely not meaningful in a tag cloud
  if (/^(can|get|may|must|will|shall|would|could|should|might|let|make)\s/.test(lowerPhrase) ||
      /\s(get|got|said|told|says|than|etc)$/.test(lowerPhrase)) {
    return false;
  }
  
  // Reject words that contain certain substrings (like JavaScript identifiers)
  if (lowerPhrase.includes('_') || 
      lowerPhrase.includes('function') || 
      lowerPhrase.includes('var') ||
      lowerPhrase.includes('const') ||
      lowerPhrase.includes('javascript')) {
    return false;
  }

  const words = lowerPhrase.split(/\s+/).filter(w => w.length > 0);

  // For single words, apply stricter filtering
  if (words.length === 1) {
    const word = words[0];
    
    // Length requirements
    if (word.length < config.minWordLength || word.length > config.maxWordLength) {
      return false;
    }

    // Filter out source names to avoid publication names dominating
    if (NEWS_SOURCE_NAMES.has(word)) {
      return false;
    }

    // Filter common web-related terms that shouldn't appear in a news tag cloud
    if (['click', 'tap', 'page', 'site', 'website', 'browser', 'app', 'login', 'password',
         'user', 'access', 'account', 'subscribe', 'subscription', 'premium', 'newsletter',
         'download', 'upload', 'file', 'button', 'menu', 'widget', 'free', 'paid', 'unlimited',
         'email', 'phone', 'contact', 'comment', 'submit', 'search', 'find', 'link'].includes(word)) {
      return false;
    }

    // More aggressive stop word filtering - filter out words that add little meaning to the cloud
    if (config.removeStopWords && 
        (STOP_WORDS.has(word) || 
         /^(get|can|may|be|have|do|go|say|see|know|like|think|come|take|make|want|use|find|give)$/.test(word)) && 
         !NEWS_SPECIFIC_WORDS.has(word) && 
         !isProperNoun(word)) {
      return false;
    }

    // Keep proper nouns even if they're short
    if (isProperNoun(word)) {
      return true;
    }

    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(word)) {
      return false;
    }
  } else {
    // For multi-word phrases, be more selective while still preserving important phrases
    if (words.length < config.minPhraseWords || words.length > config.maxPhraseWords) {
      return false;
    }
    
    // For 2-word phrases, at least one word should NOT be a stop word
    if (words.length === 2) {
      const allStopWords = words.every(w => STOP_WORDS.has(w) && !NEWS_SPECIFIC_WORDS.has(w) && !isProperNoun(w));
      if (allStopWords) {
        return false;
      }
    }
    
    // Allow longer phrases (3+ words) even if they contain stop words, they're likely meaningful
    return words.length >= 3 || words.some(w => isProperNoun(w) || NEWS_SPECIFIC_WORDS.has(w));
  }

  return true;
};

/**
 * Processes news items to generate refined keywords using NLP techniques
 * @param {Array<Object>} newsItems - Array of news item objects
 * @param {Object} config - Configuration options
 * @returns {Array<Object>} - News items with extracted keywords
 */
const processNewsKeywords = async (newsItems, config = DEFAULT_CONFIG) => {
  console.log(`[WordProcessingService] Starting keyword processing for ${newsItems?.length || 0} items.`);
  if (!newsItems || !Array.isArray(newsItems) || newsItems.length === 0) {
    return [];
  }

  // Default configuration merged with provided config
  config = { ...DEFAULT_CONFIG, ...config };
  let totalRawKeywords = 0;
  
  // Create corpus-wide term frequency map
  const corpusTerms = new Map();
  
  // First pass: collect statistics about terms across all documents
  for (const item of newsItems) {
    if (!item) continue;
    
    const rawText = `${item.title || ''} ${item.description || ''}`;
    if (!rawText.trim()) continue;
    
    // Clean and normalize text
    const cleanText = stripHtml(rawText).trim();
    
    // Extract words for corpus statistics
    const words = cleanText.split(/\W+/)
      .filter(word => word.length >= 3) // Minimum word length for corpus stats
      .map(word => word.toLowerCase());
    
    // Count each word's occurrence in the corpus
    words.forEach(word => {
      corpusTerms.set(word, (corpusTerms.get(word) || 0) + 1);
    });
  }
  
  // Second pass: Process each item to extract keywords with improved relevance
  const finalItems = await Promise.all(newsItems.map(async (item) => {
    try {
      if (!item) return null;
      
      // Create a copy of the item to avoid modifying the original
      const newItem = { ...item };
      
      // Extract raw text from title and description
      const rawText = `${item.title || ''} ${item.description || ''}`;
      if (!rawText.trim()) {
        console.warn(`[WordProcessingService] Empty content for item ${item.id}`);
        return newItem;
      }
      
      // Clean text: normalize whitespace, remove HTML entities
      const cleanText = stripHtml(rawText).trim();
      
      // Store keywords with their weights
      const keywordScores = new Map();
      
      // Extract named entities and meaningful phrases
      const phrases = extractMeaningfulPhrases(cleanText);
      
      // Process extracted phrases with weights
      phrases.forEach(phrase => {
        if (typeof phrase === 'object' && phrase.text) {
          // Handle new format with weighted phrases
          const phraseTerm = phrase.text.toLowerCase().trim();
          if (phraseTerm && shouldKeepWord(phraseTerm, config)) {
            // Use the weight provided by the named entity extraction
            keywordScores.set(phraseTerm, (keywordScores.get(phraseTerm) || 0) + phrase.weight);
          }
        } else if (typeof phrase === 'string') {
          // Handle older format for backward compatibility
          const phraseTerm = phrase.toLowerCase().trim();
          if (phraseTerm && shouldKeepWord(phraseTerm, config)) {
            keywordScores.set(phraseTerm, (keywordScores.get(phraseTerm) || 0) + 1.0);
          }
        }
      });
      
      // Lemmatize and filter individual words
      const words = cleanText.split(/\W+/)
        .filter(word => word.length >= config.minWordLength)
        .map(word => lemmatizeWord(word))
        .filter(word => shouldKeepWord(word, config));
      
      // Enhance title terms with higher weight
      if (item.title) {
        const titleClean = stripHtml(item.title).trim();
        const titleWords = titleClean.split(/\W+/)
          .filter(word => word.length >= config.minWordLength)
          .map(word => lemmatizeWord(word))
          .filter(word => shouldKeepWord(word, config));
        
        titleWords.forEach(word => {
          const term = word.toLowerCase();
          // Title words get 1.5x weight
          keywordScores.set(term, (keywordScores.get(term) || 0) + 1.5);
        });
      }
      
      // Add individual words with basic weight
      words.forEach(word => {
        const term = word.toLowerCase();
        // Check if it's already in the list (from phrases or title)
        if (!keywordScores.has(term)) {
          // Adjust word importance based on corpus frequency
          const corpusFreq = corpusTerms.get(term) || 1;
          const documentRelevance = 1 / Math.sqrt(corpusFreq); // Lower weight for very common terms
          keywordScores.set(term, 0.8 * documentRelevance); // Base weight for individual words
        }
      });
      
      // Convert Map to sorted Array of keywords (highest weight first)
      const sortedKeywords = Array.from(keywordScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25) // Limit to 25 most relevant keywords per item
        .map(entry => entry[0]);
      
      newItem.keywords = sortedKeywords;
      totalRawKeywords += newItem.keywords.length;
      
      return newItem;
    } catch (error) {
      console.error(`[WordProcessingService] Error processing item: ${error.message}`);
      return item; // Return original item on error
    }
  }));

  console.log(`[WordProcessingService] Finished processing. Input keywords: ${totalRawKeywords}, Output keywords: ${finalItems.reduce((sum, item) => sum + (item?.keywords?.length || 0), 0)}`);
  return finalItems;
};

/**
 * Aggregates keywords from a list of news items for the tag cloud.
 * Calculates frequency counts for each keyword, with bias information.
 *
 * @param {Array<Object>} newsItems - Array of news item objects, each expected to have a `keywords` array field.
 * @param {number} maxWords - The maximum number of words to return for the cloud.
 * @returns {Array<{text: string, value: number, bias: PoliticalBias}>} - Array of objects for the tag cloud, including bias.
 */
const aggregateKeywordsForCloud = (newsItems, maxWords = 1000) => {
  if (!newsItems || newsItems.length === 0) {
    return [];
  }

  // Store frequency, sources by bias, and bias weight for each keyword
  const wordData = new Map();

  // Process all keywords from all news items
  newsItems.forEach(item => {
    // Ensure source and bias exist, default to Unknown if not
    const itemBias = item.source?.bias || PoliticalBias.Unknown; 
    if (!itemBias) {
      console.warn(`Item is missing bias information: ${item.id}`);
    }

    if (item.keywords && Array.isArray(item.keywords)) {
      // Process each keyword from this item
      item.keywords.forEach(keyword => {
        if (typeof keyword === 'string') {
          // Clean and normalize the keyword
          const cleanKeyword = stripHtml(keyword);
          if (!cleanKeyword || cleanKeyword.length < 2) return; // Skip empty or very short keywords
          
          const lowerKeyword = cleanKeyword.toLowerCase().trim();
          
          // Skip keywords that contain problematic patterns (simplified check to allow more words)
          if (lowerKeyword.includes('href=') || 
              lowerKeyword.includes('src=') || 
              lowerKeyword.includes('http:') || 
              lowerKeyword.includes('https:')) {
            return;
          }
          
          // Add or update the keyword in our map
          if (!wordData.has(lowerKeyword)) {
            // First time seeing this keyword, store its data
            wordData.set(lowerKeyword, { 
              value: 1, 
              bias: itemBias, // Assign initial bias
              biasCounts: { [itemBias]: 1 } // Track bias occurrences
            });
          } else {
            // Already seen, update counts and bias tracking
            const currentData = wordData.get(lowerKeyword);
            currentData.value += 1;
            
            // Update bias tracking
            if (!currentData.biasCounts[itemBias]) {
              currentData.biasCounts[itemBias] = 1;
            } else {
              currentData.biasCounts[itemBias] += 1;
            }
            
            // Recalculate dominant bias
            let maxCount = 0;
            let dominantBias = currentData.bias;
            
            Object.entries(currentData.biasCounts).forEach(([bias, count]) => {
              if (count > maxCount) {
                maxCount = count;
                dominantBias = bias;
              }
            });
            
            currentData.bias = dominantBias;
          }
        }
      });

      // Also add the title words as keywords (optional, helps increase keyword count)
      if (item.title) {
        const titleWords = item.title.split(/\s+/).filter(w => w.length >= 3 && w.length <= 20);
        titleWords.forEach(word => {
          const cleanWord = stripHtml(word).toLowerCase().trim();
          if (cleanWord && !STOP_WORDS.has(cleanWord)) {
            if (!wordData.has(cleanWord)) {
              wordData.set(cleanWord, {
                value: 1,
                bias: itemBias,
                biasCounts: { [itemBias]: 1 }
              });
            } else {
              const currentData = wordData.get(cleanWord);
              currentData.value += 0.5; // Lower weight for title words
              
              // Update bias tracking (same as above)
              if (!currentData.biasCounts[itemBias]) {
                currentData.biasCounts[itemBias] = 1;
              } else {
                currentData.biasCounts[itemBias] += 1;
              }
              
              let maxCount = 0;
              let dominantBias = currentData.bias;
              
              Object.entries(currentData.biasCounts).forEach(([bias, count]) => {
                if (count > maxCount) {
                  maxCount = count;
                  dominantBias = bias;
                }
              });
              
              currentData.bias = dominantBias;
            }
          }
        });
      }
    }
  });

  // Convert map to array, sort by frequency descending, and take top N
  const sortedKeywords = Array.from(wordData.entries())
    .map(([text, data]) => ({
      text, 
      value: data.value, 
      bias: data.bias // Include the calculated dominant bias
    }))
    .filter(item => {
      // Simplified filtering to allow more terms
      return item.text && 
             item.text.length >= 2 && 
             item.text.length <= 50;
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, maxWords);

  console.log(`[aggregateKeywordsForCloud] Aggregated ${sortedKeywords.length} unique keywords with bias from ${newsItems.length} items.`);
  return sortedKeywords;
};

module.exports = {
  processNewsKeywords,
  aggregateKeywordsForCloud,
  DEFAULT_CONFIG
}; 