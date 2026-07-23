/**
 * LLM Service for news article analysis
 * Handles bias detection and keyword extraction using local Ollama instance
 */
const axios = require('axios');
const crypto = require('crypto');
const { LRUCache } = require('lru-cache');
const { PoliticalBias, NewsCategory } = require('../types');
const { lemmatizeWord } = require('../utils/textUtils');
const fs = require('fs');
const path = require('path');

// Determine Ollama API URL
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
console.log(`[LLM Service] Using Ollama API URL: ${OLLAMA_API_URL}`);

// Provider switch: 'ollama' (local dev, full control) or 'groq' (hosted
// environments with no local GPU and/or restricted outbound egress - Groq's
// API is plain HTTPS on 443, which fits GoDaddy Node hosting's network policy).
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
if (LLM_PROVIDER === 'groq') {
  console.log(`[LLM Service] Using Groq API with model: ${GROQ_MODEL}`);
}

// <<< Read LLM config >>>
let activeModel = 'llama3:8b'; // Default fallback
const configPath = path.join(__dirname, '..', '..', 'config', 'llmConfig.json');
try {
  const configData = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configData);
  if (config && config.activeModel) {
    activeModel = config.activeModel;
    console.log(`[LLM Service] Loaded active model from config: ${activeModel}`);
  } else {
    console.warn(`[LLM Service] activeModel not found in ${configPath}, using default: ${activeModel}`);
  }
} catch (err) {
  console.error(`[LLM Service] Error reading ${configPath}, using default model ${activeModel}. Error: ${err.message}`);
}
// <<< End reading config >>>

// Configure caching
const cache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60 * 24 // 24 hour cache
});

// Function to dynamically set the active model
// This will be called by the route handler when the config file is updated
function setActiveModel(newModelName) {
  if (newModelName && typeof newModelName === 'string' && newModelName.trim() !== '') {
    const trimmedNewModel = newModelName.trim();
    if (activeModel !== trimmedNewModel) {
      activeModel = trimmedNewModel;
      console.log(`[LLM Service] Active model dynamically updated to: ${activeModel}`);
      // Optional: Clear cache if model change could affect output for the same input.
      // For now, we assume cache keys are specific enough (include title/sentence).
      // If different models produce different keywords/bias for identical inputs,
      // and you want the new model's output immediately even for cached entries,
      // you might need to clear or selectively invalidate the cache here.
      // e.g., cache.clear();
    } else {
      console.log(`[LLM Service] Attempted to set active model to ${trimmedNewModel}, but it's already the current model.`);
    }
    return true;
  }
  console.warn(`[LLM Service] Invalid model name provided to setActiveModel: ${newModelName}`);
  return false;
}

/**
 * Send a prompt to whichever provider is configured and return the raw text
 * response (JSON extraction/parsing happens in the caller, same for both
 * providers). Errors propagate with the same axios error shape (error.code,
 * error.response) that the retry/fallback logic below already handles.
 */
async function callLLM(promptText) {
  if (LLM_PROVIDER === 'groq') {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set but LLM_PROVIDER=groq');
    }
    const response = await axios.post(GROQ_API_URL, {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.2,
      top_p: 0.7,
      response_format: { type: 'json_object' }
    }, {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    return response.data.choices[0].message.content;
  }

  const response = await axios.post(`${OLLAMA_API_URL}/api/generate`, {
    model: activeModel,
    format: 'json',
    prompt: promptText,
    stream: false,
    options: {
      num_ctx: 4096,
      temperature: 0.2,
      top_k: 20,
      top_p: 0.7,
      seed: 42
    }
  });
  return response.data.response;
}

/**
 * Create hash for cache keys
 */
function createHash(text) {
  // Normalize before hashing: lowercase and remove punctuation/excess whitespace
  const normalizedText = text.toLowerCase().replace(/[.,\/#!$%^&*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ").trim();
  return crypto.createHash('md5').update(normalizedText).digest('hex');
}

// Compact category hints (short parenthetical cues, not full sentences) -
// keeps the one shared instruction block cheap since it's paid once per
// batch rather than once per article.
const CATEGORY_HINTS = 'POLITICS (govt/elections), WORLD (international), US (domestic non-political), ' +
  'ECONOMICS (business/markets), TECH (software/gadgets), AI, SCIENCE (research), ' +
  'SPACE (astronomy/spaceflight), HEALTH (medicine), ENVIRONMENT (climate/energy), SPORTS, ' +
  'ENTERTAINMENT (film/TV/celebs), MUSIC, ARTS (visual/theater/lit), FASHION, LAW (courts/trials), ' +
  'NEWS (only if nothing else fits)';

function buildBatchPrompt(articles) {
  const list = articles
    .map((a, i) => `${i + 1}. ${a.title}${a.firstSentence ? ' | ' + a.firstSentence : ''}`)
    .join('\n');
  return `For each numbered news item below, judge bias from ITS OWN wording (not the source), pick one category, and extract keywords.
Bias: Left, Liberal, Centrist, Conservative, Right, or Unknown - judge only from partisan language actually present; neutral/factual or non-political text is Centrist or Unknown.
Category (one): ${CATEGORY_HINTS}.
Keywords: 1-3 short specific entities/topics from the text, most central first; skip generic words (news, update, says, latest, report) and source names.

Items:
${list}

Respond ONLY with JSON: {"results":[{"bias":"..","category":"..","keywords":["..",".."]}]} - exactly ${articles.length} objects, same order as the items.`;
}

// Shared per-field cleanup, used whether a result came from the LLM just now
// or was already sitting in the cache.
function normalizeResult(raw) {
  const llmBias = raw && raw.bias ? mapToPoliticalBias(raw.bias) : PoliticalBias.Unknown;
  const rawCategory = raw && typeof raw.category === 'string' ? raw.category.trim().toUpperCase() : null;
  const category = rawCategory && Object.values(NewsCategory).includes(rawCategory) ? rawCategory : null;
  const keywords = raw && Array.isArray(raw.keywords)
    ? raw.keywords
      .map(k => (typeof k === 'string' ? k.trim() : ''))
      .filter(k => k.length > 0)
      .map(k => lemmatizeWord(k))
      .filter(k => {
        const words = k.split(' ');
        return words.length >= 1 && words.length <= 4 &&
          !['news', 'update', 'read more', 'latest', 'breaking'].includes(k) &&
          !(words.length === 1 && ['a', 'an', 'and', 'the', 'of', 'to', 'in', 'for', 'with', 'on', 'by', 'at'].includes(k));
      })
      .filter((value, index, self) => self.indexOf(value) === index)
    : [];
  return { llmBias, category, keywords };
}

const FALLBACK_RESULT = { llmBias: PoliticalBias.Unknown, category: null, keywords: [] };

/**
 * Label a batch of articles (title + optional first sentence) in as few LLM
 * calls as possible: cached articles are resolved instantly, and every
 * uncached article is sent as one combined call rather than one call each -
 * the fixed instruction block above is the dominant cost per call, so
 * batching directly multiplies how many articles fit in a rate-limited
 * provider's per-minute token budget.
 *
 * @param {Array<{title: string, firstSentence?: string}>} articles
 * @returns {Promise<Array<{llmBias: string, category: string|null, keywords: string[]}>>}
 *   Same length and order as the input.
 */
async function processArticlesBatch(articles) {
  const results = new Array(articles.length);
  const toFetch = []; // { index, title, firstSentence, cacheKey }

  articles.forEach((article, index) => {
    const title = article.title || '';
    if (!title.trim()) {
      results[index] = FALLBACK_RESULT;
      return;
    }
    const inputText = `${title}${article.firstSentence ? '. ' + article.firstSentence : ''}`;
    const cacheKey = `article-v4-${createHash(inputText)}`;
    if (cache.has(cacheKey)) {
      results[index] = cache.get(cacheKey);
      return;
    }
    toFetch.push({ index, title, firstSentence: article.firstSentence || '', cacheKey });
  });

  if (toFetch.length === 0) return results;

  // Network/server errors propagate to processArticlesBatchWithRetry below,
  // which decides whether to retry the whole call - only a malformed-but-
  // received response (bad JSON from the model itself) is handled here as a
  // per-batch fallback, since retrying won't fix that.
  const responseText = await callLLM(buildBatchPrompt(toFetch));

  let parsedResults = [];
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    parsedResults = Array.isArray(parsed.results) ? parsed.results : [];
  } catch (e) {
    console.error(`[LLM Service] Failed to parse batch JSON response (${toFetch.length} articles). Response: ${responseText}. Error:`, e);
  }

  toFetch.forEach((item, i) => {
    const normalized = parsedResults[i] ? normalizeResult(parsedResults[i]) : FALLBACK_RESULT;
    // Cache fallbacks too, so a malformed response for one article doesn't
    // get retried at full cost within the same 24h cache window.
    cache.set(item.cacheKey, normalized);
    results[item.index] = normalized;
  });

  return results;
}

/**
 * Batch version with retry: on a network/server error the WHOLE call is
 * retried (not per-article), since the failure isn't specific to any one
 * article in the batch.
 */
async function processArticlesBatchWithRetry(articles, retries = 2) {
  try {
    return await processArticlesBatch(articles);
  } catch (error) {
    const isNetworkError = error.code === 'ECONNREFUSED' ||
      error.code === 'ECONNRESET' ||
      (error.message && error.message.toLowerCase().includes('socket hang up')) ||
      (error.message && error.message.toLowerCase().includes('timeout'));
    const isServerError = error.response && (error.response.status === 500 || error.response.status === 503 || error.response.status === 504);

    if ((isNetworkError || isServerError) && retries > 0) {
      console.warn(`[LLM Service] Retrying batch of ${articles.length} due to ${error.message}. Retries left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, 1500 + ((2 - retries) * 1000)));
      return processArticlesBatchWithRetry(articles, retries - 1);
    }

    console.error(`[LLM Service] Final failure for batch of ${articles.length} after retries or unretryable error: ${error.message}`);
    return articles.map(() => FALLBACK_RESULT);
  }
}

/**
 * Map a text bias string to PoliticalBias enum
 * 
 * @param {string} biasString - The bias string from LLM
 * @returns {string} - The corresponding PoliticalBias value
 */
function mapToPoliticalBias(biasString) {
  // Ensure biasString is a string and handle null/undefined safely
  const normalized = typeof biasString === 'string' ? biasString.toLowerCase() : '';

  // Use strict equality or more specific checks if needed based on PoliticalBias enum structure
  if (normalized === 'left') return PoliticalBias.Left;
  if (normalized === 'liberal') return PoliticalBias.Liberal;
  if (normalized === 'centrist') return PoliticalBias.Centrist;
  if (normalized === 'conservative') return PoliticalBias.Conservative;
  if (normalized === 'right') return PoliticalBias.Right;

  // More robust check using includes as a fallback, but prioritize exact matches
  if (normalized.includes('left')) return PoliticalBias.Left;
  if (normalized.includes('liberal')) return PoliticalBias.Liberal;
  if (normalized.includes('centrist')) return PoliticalBias.Centrist;
  if (normalized.includes('conservative')) return PoliticalBias.Conservative;
  if (normalized.includes('right')) return PoliticalBias.Right;

  return PoliticalBias.Unknown;
}

// Function to get the currently configured model name
function getCurrentModelName() {
  // Read directly from the variable loaded from config
  return activeModel;
}

module.exports = {
  processArticlesBatchWithRetry,
  getCurrentModelName,
  setActiveModel
};
