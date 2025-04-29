const natural = require('natural');
const nlp = require('compromise');

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
  // ... (Keep the extensive list of verbs, time-related, general/abstract words, adjectives, adverbs, ordinals/titles, section titles) ...
  // [Existing extensive list remains here - truncated for brevity in this example]
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

// Configuration options for word processing
const DEFAULT_CONFIG = {
  minWordLength: 4, // Increased from 3 to reduce short, non-descriptive words
  maxWordLength: 30,
  minTfidfScore: 1.2, // Increased from 0.8 to be more selective
  maxWords: 500,
  removeStopWords: true,
  minPhraseWords: 2, // Minimum words in a phrase to consider it
  maxPhraseWords: 5, // Maximum words in a phrase
  minPhraseTfidfScore: 1.5 // Higher threshold for phrases
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
 * Detects meaningful phrases using NLP
 */
const extractMeaningfulPhrases = (text) => {
  const doc = nlp(text);
  const phrases = [];

  // Get noun phrases
  doc.match('#Adjective+ #Noun+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.split(' ').length >= DEFAULT_CONFIG.minPhraseWords &&
        phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push(phrase);
    }
  });

  // Get verb phrases
  doc.match('#Noun+ #Verb+ #Noun+').forEach(match => {
    const phrase = match.text('normal');
    if (phrase.split(' ').length >= DEFAULT_CONFIG.minPhraseWords &&
        phrase.split(' ').length <= DEFAULT_CONFIG.maxPhraseWords) {
      phrases.push(phrase);
    }
  });

  return phrases;
};

/**
 * Determines if a word should be kept based on configuration and filter lists
 */
const shouldKeepWord = (phrase, config) => {
  const lowerPhrase = phrase.toLowerCase();
  
  // Always keep important descriptive words
  if (IMPORTANT_DESCRIPTIVE_WORDS.has(lowerPhrase)) {
    return true;
  }

  // Block phrases containing "cartoon" or purely numeric strings
  if (lowerPhrase.includes('cartoon') || /^\d+$/.test(phrase)) {
    return false;
  }

  const words = lowerPhrase.split(/\s+/).filter(w => w.length > 0);

  // For single words, apply stricter filtering
  if (words.length === 1) {
    const word = words[0];
    
    // Check length requirements
    if (word.length < config.minWordLength || word.length > config.maxWordLength) {
      return false;
    }

    // Filter out source names and stop words
    if (NEWS_SOURCE_NAMES.has(word)) {
      return false;
    }

    if (config.removeStopWords && STOP_WORDS.has(word) && !NEWS_SPECIFIC_WORDS.has(word)) {
      return false;
    }

    // Keep proper nouns even if they're short
    if (isProperNoun(word)) {
      return true;
    }

    // Additional checks for single words
    if (!/[a-zA-Z]/.test(word)) { // Must contain at least one letter
      return false;
    }
  } else {
    // For multi-word phrases, check if it's a meaningful phrase
    return words.length >= config.minPhraseWords && 
           words.length <= config.maxPhraseWords &&
           !words.every(w => STOP_WORDS.has(w));
  }

  return true;
};

/**
 * Processes news items to generate refined keywords using TF-IDF scoring
 */
const processNewsKeywords = async (newsItems, config = DEFAULT_CONFIG) => {
  console.log(`[WordProcessingService] Starting keyword processing for ${newsItems.length} items.`);
  if (!newsItems || newsItems.length === 0) return [];

  // Initialize TF-IDF
  const tfidf = new natural.TfIdf();
  const documents = [];
  let totalRawKeywords = 0;
  let totalLemmatizedKeywords = 0;

  // Extract meaningful phrases from titles and descriptions
  const processedItems = newsItems.map(item => {
    const rawKeywords = (item.keywords || [])
      .map(kw => kw?.toLowerCase().trim())
      .filter(kw => kw && kw.length > 0);
    
    // Add phrases from title and description
    const titlePhrases = extractMeaningfulPhrases(item.title);
    const descPhrases = extractMeaningfulPhrases(item.description);
    const allPhrases = [...new Set([...rawKeywords, ...titlePhrases, ...descPhrases])];
    
    totalRawKeywords += allPhrases.length;
    const lemmatizedKeywords = allPhrases.map(lemmatizeWord);
    totalLemmatizedKeywords += lemmatizedKeywords.length;

    if (lemmatizedKeywords.length > 0) {
      tfidf.addDocument(lemmatizedKeywords);
      documents.push(lemmatizedKeywords);
    } else {
      documents.push([]);
    }

    return { ...item, processedKeywords: lemmatizedKeywords };
  });

  // Calculate TF-IDF scores with different thresholds for single words and phrases
  const termScores = new Map();
  const uniqueLemmas = new Set();
  processedItems.forEach(item => item.processedKeywords.forEach(lemma => uniqueLemmas.add(lemma)));

  uniqueLemmas.forEach(lemma => {
    let maxScore = 0;
    tfidf.tfidfs(lemma, (docIndex, score) => {
      if (score > maxScore) maxScore = score;
    });
    
    // Apply different thresholds based on whether it's a single word or phrase
    const isPhrase = lemma.includes(' ');
    const threshold = isPhrase ? config.minPhraseTfidfScore : config.minTfidfScore;
    
    if (maxScore >= threshold) {
      termScores.set(lemma, maxScore);
    }
  });

  // Process and return items with refined keywords
  const finalItems = processedItems.map(item => {
    const filteredKeywords = item.processedKeywords
      .filter(lemma => {
        const score = termScores.get(lemma);
        return score && shouldKeepWord(lemma, config);
      })
      .sort((a, b) => (termScores.get(b) || 0) - (termScores.get(a) || 0))
      .slice(0, config.maxWords);

    const newItem = { ...item };
    delete newItem.processedKeywords;
    newItem.keywords = filteredKeywords;
    return newItem;
  });

  console.log(`[WordProcessingService] Finished processing. Input keywords: ${totalRawKeywords}, Output keywords: ${finalItems.reduce((sum, item) => sum + item.keywords.length, 0)}`);
  return finalItems;
};

module.exports = {
  processNewsKeywords,
  DEFAULT_CONFIG
}; 