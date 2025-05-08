const natural = require('natural');
const nlp = require('compromise');
const { PoliticalBias, NewsCategory } = require('../types');
const { processArticleWithRetry } = require('./llmService');
const NewsItem = require('../models/NewsItem');
const { lemmatizeWord, stripHtml, isProperNoun } = require('../utils/textUtils');
// const { getSourcesConfiguration } = require('../config/config'); // Keep if used by other functions not shown here

// Define Keyword Length Constants
const MIN_KEYWORD_LENGTH = 3;
const MAX_KEYWORD_LENGTH = 50;

// --- NEW Single Keyword Cache (Map-based) ---
let keywordCache = {
  data: new Map(), // Map<string, { count: number, biases: PoliticalBias[], categories: NewsCategory[], items: Set<string> }>
  timestamp: null,
  sourcesTimestamp: null, // Timestamp for when NEWS_SOURCE_NAMES was last updated
  isUpdating: false // Lock to prevent concurrent full updates of keywordCache.data by aggregateKeywordsForCloud
};

// Counter for LLM fallbacks
let llmFallbackCount = 0;
const getLlmFallbackCount = () => {
  return llmFallbackCount;
};

// **Expanded and Merged Stop Words List** (Copied from your provided file)
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'this', 'but', 'they', 'have', 'had', 'what', 'when',
  'where', 'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'can', 'just', 'should', 'now', 'she', 'him', 'her',
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
  'want', 'call', 'file', 'find', 'lose', 'make', 'write', 'help', 'set', 'need',
  "you're", "you",
  'here',
  'today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'day', 'hour', 'minute', 'second',
  'morning', 'afternoon', 'evening', 'night', 'midnight', 'noon', 'daily', 'weekly', 'monthly', 'annual', 'biannual',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'date', 'time', 'period', 'season', 'era', 'century', 'decade', 'moment', 'schedule',
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

const NEWS_SPECIFIC_WORDS = new Set([ // (Copied from your provided file)
  'breaking', 'exclusive', 'update', 'live', 'developing', 'urgent'
]);

const NEWS_SOURCE_NAMES = new Set([ // (Copied from your provided file)
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
]);

const DEFAULT_CONFIG = { // (Copied from your provided file)
  minWordLength: MIN_KEYWORD_LENGTH, 
  maxWordLength: MAX_KEYWORD_LENGTH, 
  minPhraseWords: 2,
  maxPhraseWords: 5,
  removeStopWords: true,
  useStemming: false,
  useLemmatization: true,
  minTfIdfScore: 0.001,
  extractNounPhrases: true,
  maxWords: 1500
};

const IMPORTANT_DESCRIPTIVE_WORDS = new Set([ // (Copied from your provided file)
  'major', 'critical', 'breaking', 'exclusive', 'urgent', 'developing',
  'investigation', 'analysis', 'report', 'update', 'crisis', 'emergency',
  'breakthrough', 'discovery', 'controversy', 'scandal', 'reform',
  'initiative', 'proposal', 'decision', 'agreement', 'conflict',
  'resolution', 'victory', 'defeat', 'success', 'failure', 'impact',
  'threat', 'risk', 'benefit', 'challenge', 'opportunity', 'progress',
  'decline', 'increase', 'decrease', 'growth', 'reduction', 'expansion',
  'collapse', 'recovery', 'revolution', 'transformation', 'innovation'
]);

const extractMeaningfulPhrases = (text) => { // (Copied from your provided file)
  const doc = nlp(text);
  const phrases = [];
  doc.match('#Person+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.length >= 3 && phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.5 });
    }
  });
  doc.match('#Organization+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.length >= 2 && phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.4 });
    }
  });
  doc.match('#Place+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.length >= 2 && phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.3 });
    }
  });
  doc.match('#Adjective+ #Noun+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.split(' ').length >= DEFAULT_CONFIG.minPhraseWords &&
        phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.0 });
    }
  });
  doc.match('#Noun+ #Verb+ #Noun+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.split(' ').length >= DEFAULT_CONFIG.minPhraseWords &&
        phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.1 });
    }
  });
  doc.match('(president|minister|official|court|government|senate|congress|police|military|forces) #Verb+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.split(' ').length >= 2 && phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push({ text: phrase, weight: 1.5 });
    }
  });
  return phrases;
};

const shouldKeepWord = (phrase, config) => { // (Copied from your provided file)
  const cleanPhrase = stripHtml(phrase);
  if (!cleanPhrase) return false;
  const lowerPhrase = cleanPhrase.toLowerCase();
  const words = lowerPhrase.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return false;
  if (IMPORTANT_DESCRIPTIVE_WORDS.has(lowerPhrase)) return true;
  if (lowerPhrase.includes('href=') || lowerPhrase.includes('src=') || lowerPhrase.includes('http:') || lowerPhrase.includes('https:') || lowerPhrase.includes('www.') || lowerPhrase.includes('@') || lowerPhrase.includes('...')) return false;
  if (lowerPhrase.includes('continue reading') || lowerPhrase.includes('read more') || lowerPhrase.includes('sign in') || lowerPhrase.includes('sign up') || lowerPhrase.includes('subscribe') || lowerPhrase.includes('click here') || lowerPhrase.includes('tap here')) return false;
  if (lowerPhrase.includes('function') || lowerPhrase.includes('var ') || lowerPhrase.includes('const ') || lowerPhrase.includes('class ') || lowerPhrase.includes('javascript')) return false;
  if (words.length === 1) {
    const word = words[0];
    if (isProperNoun(word)) return true;
    if (word.length < config.minWordLength || word.length > config.maxWordLength) return false;
    if (/^\d+$/.test(word) || /^[a-z]$/.test(word) || /^[a-z]\d+$/.test(word)) return false;
    if (NEWS_SOURCE_NAMES.has(word)) return false;
    if (config.removeStopWords && STOP_WORDS.has(word) && !NEWS_SPECIFIC_WORDS.has(word)) return false;
    return /[a-zA-Z]/.test(word);
  } else {
    if (words.length < config.minPhraseWords || words.length > config.maxPhraseWords) return false;
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    const meaninglessPrefixes = ['a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'am', 'is', 'are', 'was', 'were', 'be', 'been'];
    const meaninglessSuffixes = ['etc', 'so', 'to', 'for', 'of', 'by', 'with', 'in', 'on', 'at'];
    if (meaninglessPrefixes.includes(firstWord) && words.length <= 2) return false;
    if (meaninglessSuffixes.includes(lastWord) && words.length <= 2) return false;
    if (words.length === 2) return words.some(w => !STOP_WORDS.has(w) || isProperNoun(w) || NEWS_SPECIFIC_WORDS.has(w));
    return !words.every(w => STOP_WORDS.has(w) && !NEWS_SPECIFIC_WORDS.has(w) && !isProperNoun(w));
  }
};

const combineKeywords = (llmKeywords, traditionalKeywords) => { // (Copied from your provided file)
  const llmKeywordSet = new Set(llmKeywords.filter(k => typeof k === 'string').map(k => k.toLowerCase()));
  const uniqueTraditionalKeywords = traditionalKeywords
    .filter(k => !llmKeywordSet.has(k.text.toLowerCase()))
    .map(keyword => {
      const wordCount = keyword.text.split(/\s+/).length;
      const isMultiWord = wordCount > 1;
      const isHighValue = keyword.value > 1.3;
      if (isMultiWord) return { ...keyword, value: keyword.value * 1.2 };
      if (!isMultiWord && !isHighValue) return { ...keyword, value: keyword.value * 0.8 };
      return keyword;
    })
    .sort((a, b) => {
      const aWords = a.text.split(/\s+/).length;
      const bWords = b.text.split(/\s+/).length;
      return (bWords - aWords) || (b.value - a.value);
    })
    .slice(0, Math.min(llmKeywords.length, 30));
  const uniqueTraditionalKeywordStrings = uniqueTraditionalKeywords.map(kw => kw.text);
  const combined = [...llmKeywords, ...uniqueTraditionalKeywordStrings];
  const casingMap = new Map();
  llmKeywords.forEach(k => { if (typeof k === 'string') casingMap.set(k.toLowerCase(), k); });
  uniqueTraditionalKeywords.forEach(kwObj => { if (typeof kwObj.text === 'string') { if (!casingMap.has(kwObj.text.toLowerCase())) casingMap.set(kwObj.text.toLowerCase(), kwObj.text); } });
  const uniqueLowercaseKeywords = Array.from(new Set(combined.filter(k => typeof k === 'string').map(k => k.toLowerCase())));
  return uniqueLowercaseKeywords.map(lk => casingMap.get(lk) || lk);
};


function filterAndValidateKeyword(originalKeyword) {
  let keyword = originalKeyword.toLowerCase().trim();
  keyword = stripHtml(keyword);

  if (keyword.length < MIN_KEYWORD_LENGTH || keyword.length > MAX_KEYWORD_LENGTH) {
    return null;
  }
  if (/\d/.test(keyword) && keyword.length < 5) {
    return null;
  } 
  if (STOP_WORDS.has(keyword) || NEWS_SPECIFIC_WORDS.has(keyword) || NEWS_SOURCE_NAMES.has(keyword)) {
    return null;
  }
  
  let beforeLemmatize = keyword;
  if (!isProperNoun(keyword)) {
    keyword = lemmatizeWord(keyword);
  }
  
  if (keyword.length < MIN_KEYWORD_LENGTH || keyword.length > MAX_KEYWORD_LENGTH) {
    return null;
  }
  if (STOP_WORDS.has(keyword)) {
    return null;
  }
  return keyword;
}

function updateGlobalCacheWithSingleItem(processedNewsItem) {
  if (!processedNewsItem || !processedNewsItem.keywords || !(processedNewsItem.minifluxEntryId || processedNewsItem._id)) {
    console.warn('[Cache Update] Attempted to update cache with invalid item (missing id or keywords): ', processedNewsItem ? (processedNewsItem._id || processedNewsItem.minifluxEntryId) : 'undefined item');
    return;
  }
  const itemId = processedNewsItem._id ? processedNewsItem._id.toString() : processedNewsItem.minifluxEntryId.toString();
  console.log(`[Cache Update] Processing item: ${itemId}, llmProcessed: ${processedNewsItem.llmProcessed}`); // <-- Log item status

  const itemBias = processedNewsItem.bias || PoliticalBias.Unknown;
  const itemCategory = (processedNewsItem.source && processedNewsItem.source.category)
    ? processedNewsItem.source.category
    : NewsCategory.UNKNOWN;

  (processedNewsItem.keywords || []).forEach(keywordText => {
    const validatedKeyword = filterAndValidateKeyword(keywordText);
    if (validatedKeyword) {
      console.log(`[Cache Update Item ${itemId}] Adding/Updating keyword: "${validatedKeyword}"`); // <-- Log keyword being processed
      if (keywordCache.data.has(validatedKeyword)) {
        const existingEntry = keywordCache.data.get(validatedKeyword);
        existingEntry.count += 1;
        existingEntry.items.add(itemId);
        if (itemBias) existingEntry.biases.push(itemBias);
        // Add category to the set, then convert set to array for storage
        const categorySet = new Set(existingEntry.categories || []);
        categorySet.add(itemCategory);
        existingEntry.categories = Array.from(categorySet);

      } else {
        keywordCache.data.set(validatedKeyword, {
          count: 1,
          biases: itemBias ? [itemBias] : [],
          categories: itemCategory ? [itemCategory] : [], // Initialize categories as an array
          items: new Set([itemId])
        });
        }
    }
  });
  keywordCache.timestamp = new Date();
  // console.log(`[Cache] Incremental update for item ${itemId}. Keywords added/updated: ${processedNewsItem.keywords.length}. Cache size: ${keywordCache.data.size}`);
}

async function processNewsKeywords(newsItemsFromDB, config = DEFAULT_CONFIG) {
  console.log(`[Word Processing Service] Starting batch processing for ${newsItemsFromDB.length} items.`);
  const processedResults = [];
  let llmFallbackCountForBatch = 0;

  for (const item of newsItemsFromDB) {
    if (!item || !item.title || !item.contentSnippet || !item._id) {
      console.warn('[Word Processing] Skipping invalid item in batch:', item ? item._id : 'undefined item');
      processedResults.push({ ...item, keywords: item.keywords || [], llmProcessed: item.llmProcessed || false, llmProcessingAttempts: (item.llmProcessingAttempts || 0) + 1, processedAt: new Date() });
      continue;
    }

    const title = stripHtml(item.title);
    const firstSentence = stripHtml(item.contentSnippet.split('.')[0] || '');
    let llmResult = null;
    // Initialize itemBias STRICTLY from item.source.bias or default to Unknown
    // This will be passed to the LLM as a hint, but LLM's bias output will not override this.
    const itemSourceBias = (item.source && item.source.bias) ? item.source.bias : PoliticalBias.Unknown;
    let keywordsToUse = item.keywords || [];
    let llmSuccess = false;

    try {
      // Pass the itemSourceBias to LLM. Its keywords will be used, but its bias suggestion will be ignored.
      llmResult = await processArticleWithRetry(title, firstSentence, itemSourceBias);
      
      if (llmResult && llmResult.keywords && llmResult.keywords.length > 0) {
        keywordsToUse = llmResult.keywords;
        // DO NOT update itemSourceBias with llmResult.bias. The source's bias is king.
        llmSuccess = true;
      } else if (llmResult && (!llmResult.keywords || llmResult.keywords.length === 0)) {
        llmFallbackCountForBatch++;
        const traditionalKeywords = extractMeaningfulPhrases(title + " " + firstSentence)
          .map(p => p.text)
          .filter(k => shouldKeepWord(k, config)); 
        keywordsToUse = traditionalKeywords.slice(0, 10); 
        llmSuccess = false; // Explicitly false, even if traditional keywords found
      } else {
        // LLM call failed or returned null/undefined
        llmFallbackCountForBatch++;
        const traditionalKeywords = extractMeaningfulPhrases(title + " " + firstSentence)
          .map(p => p.text)
          .filter(k => shouldKeepWord(k, config));
        keywordsToUse = traditionalKeywords.slice(0, 10);
        llmSuccess = false;
      }
    } catch (error) {
      console.error(`Error processing article ${item._id} with LLM:`, error.message);
      llmFallbackCountForBatch++;
      const traditionalKeywords = extractMeaningfulPhrases(title + " " + firstSentence)
        .map(p => p.text)
        .filter(k => shouldKeepWord(k, config));
      keywordsToUse = traditionalKeywords.slice(0, 10);
      llmSuccess = false;
    }

    const finalKeywords = Array.from(new Set(keywordsToUse.map(k => filterAndValidateKeyword(k)).filter(Boolean)));
    const processedItem = {
      ...item, // Spread original item data (like minifluxEntryId, _id, etc.)
      title: item.title, // ensure original title is preserved if needed by other parts
      contentSnippet: item.contentSnippet, // ensure original snippet is preserved
      keywords: finalKeywords,
      // Ensure the bias saved is ALWAYS the itemSourceBias (derived from item.source.bias).
      bias: itemSourceBias,
      // category: item.category, // item.category is already part of ...item spread if it exists. Redundant.
      // source: item.source, // item.source is already part of ...item spread. Redundant unless structure needs modification.
      llmProcessed: llmSuccess,
      llmProcessingAttempts: (item.llmProcessingAttempts || 0) + 1,
      processedAt: new Date()
    };
    
    updateGlobalCacheWithSingleItem(processedItem); 
    processedResults.push(processedItem);
  }
  
  if (llmFallbackCountForBatch > 0) {
    console.log(`[Word Processing Service] LLM fallback used for ${llmFallbackCountForBatch} items in this batch.`);
  }
  console.log(`[Word Processing Service] Finished batch processing. ${processedResults.length} items processed and cache updated.`);
  return processedResults;
}

async function aggregateKeywordsForCloud() {
  if (keywordCache.isUpdating) {
    console.log('[Cache Aggregation] Full aggregation already in progress. Skipping.');
    return;
  }
  keywordCache.isUpdating = true;
  console.log('[Cache Aggregation] Starting full keyword aggregation for global cache...');
  
  try {
    const allNewsItems = await NewsItem.find({ llmProcessed: true }).lean().exec(); 
    console.log(`[Cache Aggregation] Found ${allNewsItems.length} items with llmProcessed:true for cache aggregation.`); // <-- Log count
    if (!allNewsItems || allNewsItems.length === 0) {
      console.log('[Cache Aggregation] No llmProcessed:true items found in DB for cache aggregation.');
      keywordCache.data = new Map();
      keywordCache.timestamp = new Date();
      keywordCache.isUpdating = false;
      return;
    }
    
    // Log first item check
    if (allNewsItems.length > 0) {
        const firstItem = allNewsItems[0];
        console.log(`[Cache Aggregation] First item check - ID: ${firstItem._id}, llmProcessed: ${firstItem.llmProcessed}`);
    }

    const tempKeywordMap = new Map(); // Map<string, { count: number, biases: Set<PoliticalBias>, categories: Set<NewsCategory>, items: Set<string> }>

    allNewsItems.forEach(item => {
      const itemBias = item.bias || PoliticalBias.Unknown;
      const itemCategory = (item.source && item.source.category)
        ? item.source.category
        : NewsCategory.UNKNOWN;

      (item.keywords || []).forEach(keywordText => {
        const validatedKeyword = filterAndValidateKeyword(keywordText);
        if (validatedKeyword) {
          // <-- Log keyword and source item details -->
          console.log(`[Cache Aggregation Item ${item._id}] Processing keyword: "${validatedKeyword}" (Source llmProcessed: ${item.llmProcessed})`); 
          if (tempKeywordMap.has(validatedKeyword)) {
            const entry = tempKeywordMap.get(validatedKeyword);
            entry.count += 1;
            entry.items.add(item._id ? item._id.toString() : item.minifluxEntryId.toString());
            if (itemBias) entry.biases.add(itemBias);
            if (itemCategory) entry.categories.add(itemCategory); // Add to set
          } else {
            tempKeywordMap.set(validatedKeyword, {
              count: 1,
              biases: itemBias ? new Set([itemBias]) : new Set(),
              categories: itemCategory ? new Set([itemCategory]) : new Set(), // Initialize as Set
              items: new Set([item._id ? item._id.toString() : item.minifluxEntryId.toString()])
            });
          }
        }
      });
    });

    // Convert sets to arrays for the final cache structure
    const newCacheData = new Map();
    tempKeywordMap.forEach((value, key) => {
      newCacheData.set(key, {
        ...value,
        biases: Array.from(value.biases),
        categories: Array.from(value.categories) // Convert categories set to array
      });
    });

    keywordCache.data = newCacheData;
    keywordCache.timestamp = new Date();
    console.log(`[WordProcessingService] Global keywordCache updated by aggregateKeywordsForCloud: ${keywordCache.data.size} unique keywords from ${allNewsItems.length} items at ${keywordCache.timestamp.toISOString()}.`);

  } catch (error) {
    console.error('[WordProcessingService] Error during full keyword aggregation:', error);
  } finally {
    keywordCache.isUpdating = false;
  }
}

function getKeywordCache() {
  return { data: keywordCache.data, timestamp: keywordCache.timestamp };
}

module.exports = {
  processNewsKeywords,
  aggregateKeywordsForCloud,
  getKeywordCache,
  getLlmFallbackCount, 
  updateGlobalCacheWithSingleItem, 
  filterAndValidateKeyword 
}; 