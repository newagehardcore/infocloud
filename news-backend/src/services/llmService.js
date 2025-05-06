/**
 * LLM Service for news article analysis
 * Handles bias detection and keyword extraction using local Ollama instance
 */
const axios = require('axios');
const crypto = require('crypto');
const { LRUCache } = require('lru-cache');
const { PoliticalBias } = require('../types');
const { lemmatizeWord } = require('../utils/textUtils');
const fs = require('fs');
const path = require('path');

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
 * Create hash for cache keys
 */
function createHash(text) {
  // Normalize before hashing: lowercase and remove punctuation/excess whitespace
  const normalizedText = text.toLowerCase().replace(/[.,\/#!$%^&*;:{}=\-_`~()]/g,"").replace(/\s{2,}/g," ").trim();
  return crypto.createHash('md5').update(normalizedText).digest('hex');
}

/**
 * Process an article headline and first sentence with LLM
 * Uses a single API call to improve efficiency
 * 
 * @param {string} title - The article title
 * @param {string} firstSentence - The first sentence of the article description (optional)
 * @returns {Promise<Object>} - Object with bias and keywords
 */
async function processArticle(title, firstSentence = '') { // Accept title and firstSentence
  // Skip empty title
  if (!title || title.trim().length === 0) {
    return {
      bias: PoliticalBias.Unknown,
      keywords: []
    };
  }
  
  // Combine title and sentence for processing and caching
  const inputText = `${title}${firstSentence ? '. ' + firstSentence : ''}`;

  // Cache key based on normalized combined input
  const cacheKey = `article-combo-${createHash(inputText)}`; 
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: activeModel,
      format: "json", // Enforce JSON output format
      prompt: `You are a highly efficient news headline analyst. Your task is to extract the political bias and 2-3 distinct, central keywords/entities from the provided headline and optional first sentence.

Analyze this input:
Headline: ${title}
First Sentence: ${firstSentence}

Respond ONLY with valid JSON containing two fields:

"bias": political bias (must be exactly one of: "Left", "Liberal", "Centrist", "Conservative", "Right", "Unknown")
"keywords": array of 2-3 UNIQUE keywords/phrases adhering to these guidelines:

**IMPORTANT KEYWORD GUIDELINES (Updated):**
1.  **Primary Topic/Entity First:** Identify the SINGLE most central subject, event, or named entity (person, place, organization). This should be the FIRST keyword in the array.
2.  **Secondary Keywords:** Add 1-2 additional distinct keywords or entities that provide essential context or detail related to the primary topic.
3.  **Total Count:** Aim for 2 keywords total, up to a maximum of 3 if absolutely necessary for clarity.
4.  **Direct Extraction:** Extract keywords DIRECTLY from the headline/sentence text.
5.  **Specificity:** Focus on specific proper nouns, core actions, or defining topics. Avoid generic words.
6.  **Brevity & Clarity:** Prefer concise terms but use multi-word phrases if needed to capture a specific concept accurately.
7.  **Original Case:** Maintain original capitalization where possible (post-processing might normalize).

**AVOID:**
*   More than 3 keywords total.
*   Redundant keywords (synonyms or minor variations of the primary topic).
*   Generic/uninformative words (e.g., "report", "update", "says", "issue", "statement").
*   Adding concepts not explicitly mentioned or paraphrasing.
*   News source names (unless they are the subject).
*   HTML code/entities, dates/times (unless central).

**BIAS CLASSIFICATION GUIDE:**
* "Left" - Strong progressive perspective, emphasizing social justice, systemic inequality, corporate criticism
* "Liberal" - Progressive-leaning but more moderate, supportive of government programs, social reform
* "Centrist" - Balanced perspective, minimal partisan language, factual reporting with limited value judgments
* "Conservative" - Traditional values, limited government, business-friendly, incremental change
* "Right" - Strong emphasis on nationalism, traditional social values, anti-regulation, skepticism of government programs
* "Unknown" - No clear political leaning detectable or not applicable to political spectrum

Respond with valid JSON only in this exact format:
{
  "bias": "[political bias category]",
  "keywords": ["primary central keyword/entity", "secondary keyword 1" ] // (optional: "secondary keyword 2")
}`,
      stream: false
    });
    
    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(response.data.response);
      
      // Ensure result has the expected structure and apply lemmatization + filtering
      result = {
        bias: mapToPoliticalBias(result.bias || ''),
        keywords: Array.isArray(result.keywords) ?
          result.keywords
            .map(k => k.trim()) // Trim whitespace first
            .filter(k => k.length > 0) // Filter empty strings after trimming
            .map(k => lemmatizeWord(k)) // Lemmatize each non-empty keyword
            .filter(k => { // Apply existing filtering logic *after* lemmatization
              const words = k.split(' ');
              // Accept 1-4 word phrases (post-lemmatization)
              return k.length > 0 && words.length >= 1 && words.length <= 4 &&
                // Filter out common generic phrases (already lowercase due to lemmatizer)
                !['news', 'update', 'read more', 'latest', 'breaking'].includes(k) &&
                // Filter out single prepositions or articles (already lowercase)
                !(words.length === 1 && ['a', 'an', 'and', 'the', 'of', 'to', 'in', 'for', 'with', 'on', 'by', 'at'].includes(k));
            })
            // Add a final uniqueness filter after lemmatization and filtering
            .filter((value, index, self) => self.indexOf(value) === index)
          : []
      };
    } catch (e) {
      // Fallback parsing for non-JSON responses
      console.error('Failed to parse LLM response as JSON:', e);
      result = {
        bias: mapToPoliticalBias(response.data.response),
        keywords: []
      };
    }
    
    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    // Clean error logging - only show essential information
    const errorMessage = error.code === 'ECONNREFUSED' 
      ? 'LLM connection failed: Ollama service not available (ECONNREFUSED)' 
      : `LLM processing failed: ${error.message || error}`;
    
    console.error(errorMessage);
    
    return {
      bias: PoliticalBias.Unknown,
      keywords: []
    };
  }
}

/**
 * Process article with retry mechanism
 * 
 * @param {string} title - The article title to analyze
 * @param {string} firstSentence - The first sentence of the article description (optional)
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object>} - Object with bias and keywords
 */
async function processArticleWithRetry(title, firstSentence = '', retries = 2) { // Accept title and firstSentence
  try {
    return await processArticle(title, firstSentence); // Pass title and firstSentence
  } catch (error) {
    // Check if it's a connection error (likely Ollama not running)
    if (error.code === 'ECONNREFUSED' && retries > 0) {
      console.log(`LLM connection failed. Retrying ${retries} more times...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      return processArticleWithRetry(title, firstSentence, retries - 1); // Pass title and firstSentence on retry
    } 
    // Other errors or out of retries
    else if (retries > 0) {
      console.log(`LLM error: ${error.message || 'Unknown error'}. Retrying ${retries} more times...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      return processArticleWithRetry(title, firstSentence, retries - 1); // Pass title and firstSentence on retry
    }
    
    // No more retries left
    console.error('LLM processing failed after all retry attempts');
    return {
      bias: PoliticalBias.Unknown,
      keywords: []
    };
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
  processArticle,
  processArticleWithRetry,
  getCurrentModelName,
  setActiveModel
};
