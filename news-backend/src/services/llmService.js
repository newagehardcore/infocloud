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
 * @param {string} existingBias - The existing bias for the article
 * @returns {Promise<Object>} - Object with bias and keywords
 */
async function processArticle(title, firstSentence = '', existingBias = PoliticalBias.Unknown) { // Accept title, firstSentence, and existingBias
  // Skip empty title
  if (!title || title.trim().length === 0) {
    return {
      bias: existingBias, // Return existing or Unknown if title is empty
      keywords: []
    };
  }
  
  // Combine title and sentence for processing and caching
  // Cache key should also consider if bias was requested, to avoid serving a keyword-only result if bias was needed later
  const requestingBias = !existingBias || existingBias === PoliticalBias.Unknown;
  const inputText = `${title}${firstSentence ? '. ' + firstSentence : ''}`;
  const cacheKey = `article-combo-${requestingBias ? 'full' : 'kw_only'}-${createHash(inputText)}`;
  
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  
  let promptInstruction = "You are a highly efficient news headline analyst. Your task is to extract ";
  let jsonFields = "";
  let jsonStructureExample = "";

  if (requestingBias) {
    promptInstruction += "the political bias and 2-3 distinct, central keywords/entities";
    jsonFields = `"bias": political bias (must be exactly one of: "Left", "Liberal", "Centrist", "Conservative", "Right", "Unknown")\n"keywords": array of 2-3 UNIQUE keywords/phrases`;
    jsonStructureExample = `{\n  "bias": "[political bias category]",\n  "keywords": ["primary central keyword/entity", "secondary keyword 1" ] // (optional: "secondary keyword 2")\n}`;
  } else {
    promptInstruction += "2-3 distinct, central keywords/entities";
    jsonFields = `"keywords": array of 2-3 UNIQUE keywords/phrases`;
    jsonStructureExample = `{\n  "keywords": ["primary central keyword/entity", "secondary keyword 1" ] // (optional: "secondary keyword 2")\n}`;
    console.log(`[LLM Service] Bias already exists for article "${title}" as "${existingBias}". Requesting keywords only.`);
  }
  
  promptInstruction += " from the provided headline and optional first sentence.";

  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: activeModel,
      format: "json", // Enforce JSON output format
      prompt: `${promptInstruction}\n\nAnalyze this input:\nHeadline: ${title}\nFirst Sentence: ${firstSentence}\n\nRespond ONLY with valid JSON containing these fields:\n\n${jsonFields} adhering to these guidelines:\n\n**IMPORTANT KEYWORD GUIDELINES (Updated):**\n1.  **Primary Topic/Entity First:** Identify the SINGLE most central subject, event, or named entity (person, place, organization). This should be the FIRST keyword in the array.\n2.  **Secondary Keywords:** Add 1-2 additional distinct keywords or entities that provide essential context or detail related to the primary topic.\n3.  **Total Count:** Aim for 2 keywords total, up to a maximum of 3 if absolutely necessary for clarity.\n4.  **Direct Extraction:** Extract keywords DIRECTLY from the headline/sentence text.\n5.  **Specificity:** Focus on specific proper nouns, core actions, or defining topics. Avoid generic words.\n6.  **Brevity & Clarity:** Prefer concise terms but use multi-word phrases if needed to capture a specific concept accurately.\n7.  **Original Case:** Maintain original capitalization where possible (post-processing might normalize).\n\n**AVOID:**\n*   More than 3 keywords total.\n*   Redundant keywords (synonyms or minor variations of the primary topic).\n*   Generic/uninformative words (e.g., "report", "update", "says", "issue", "statement").\n*   Adding concepts not explicitly mentioned or paraphrasing.\n*   News source names (unless they are the subject).\n*   HTML code/entities, dates/times (unless central).\n\n${requestingBias ? "**BIAS CLASSIFICATION GUIDE:**\n* \"Left\" - Strong progressive perspective, emphasizing social justice, systemic inequality, corporate criticism\n* \"Liberal\" - Progressive-leaning but more moderate, supportive of government programs, social reform\n* \"Centrist\" - Balanced perspective, minimal partisan language, factual reporting with limited value judgments\n* \"Conservative\" - Traditional values, limited government, business-friendly, incremental change\n* \"Right\" - Strong emphasis on nationalism, traditional social values, anti-regulation, skepticism of government programs\n* \"Unknown\" - No clear political leaning detectable or not applicable to political spectrum\n\n" : "" }Respond with valid JSON only in this exact format:\n${jsonStructureExample}`,
      stream: false
    });
    
    // Parse the JSON response
    let resultJson;
    try {
      resultJson = JSON.parse(response.data.response);
      
      // Determine bias: use LLM's bias if requested and present, otherwise use existingBias
      const finalBias = requestingBias 
                        ? mapToPoliticalBias(resultJson.bias || '') 
                        : existingBias;

      const processedResult = {
        bias: finalBias,
        keywords: Array.isArray(resultJson.keywords) ?
          resultJson.keywords
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
      cache.set(cacheKey, processedResult);
      return processedResult;
    } catch (e) {
      console.error(`[LLM Service] Failed to parse LLM JSON response for article "${title}". Response: ${response.data.response}. Error:`, e);
      // Fallback if JSON parsing fails but bias was requested
      const fallbackBias = requestingBias ? mapToPoliticalBias(response.data.response) : existingBias;
      const fallbackResult = {
        bias: fallbackBias,
        keywords: []
      };
      cache.set(cacheKey, fallbackResult); // Cache fallback to prevent re-processing bad response
      return fallbackResult;
    }
  } catch (error) {
    const errorMessage = error.code === 'ECONNREFUSED' 
      ? `LLM connection failed for article "${title}": Ollama service not available (ECONNREFUSED)`
      : `LLM processing error for article "${title}" (First sentence: "${firstSentence ? firstSentence.substring(0,50)+'...' : 'N/A'}"): ${error.response ? error.response.status + ' ' + error.response.statusText : error.message || error}`;
    
    console.error(errorMessage);
    // Log the actual error object if it's not a connection refusal, for more details on 500s etc.
    if (error.code !== 'ECONNREFUSED' && error.response) {
        console.error('[LLM Service] Ollama Error Response Data:', error.response.data);
    }
    
    return {
      bias: existingBias, // On error, retain existing bias or Unknown
      keywords: []
    };
  }
}

/**
 * Process article with retry mechanism
 * 
 * @param {string} title - The article title to analyze
 * @param {string} firstSentence - The first sentence of the article description (optional)
 * @param {string} existingBias - The existing bias for the article
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object>} - Object with bias and keywords
 */
async function processArticleWithRetry(title, firstSentence = '', existingBias = PoliticalBias.Unknown, retries = 2) { // Accept and pass existingBias
  try {
    // Pass existingBias to processArticle
    return await processArticle(title, firstSentence, existingBias);
  } catch (error) {
    // Check if it's a connection error (likely Ollama not running) or a specific type of server error we want to retry
    const shouldRetry = (error.code === 'ECONNREFUSED' || (error.response && error.response.status === 500));

    if (shouldRetry && retries > 0) {
      console.log(`LLM connection/server error for article "${title}". Retrying ${retries} more times...`);
      await new Promise(resolve => setTimeout(resolve, 1000 + ( (2 - retries) * 500) )); // Wait 1s, 1.5s for subsequent retries
      // Pass existingBias on retry
      return processArticleWithRetry(title, firstSentence, existingBias, retries - 1);
    } 
    
    // No more retries left or not a retryable error
    console.error(`LLM processing failed for article "${title}" after all retry attempts or due to unretryable error: ${error.message}`);
    return {
      bias: existingBias, // On final failure, retain existing bias or Unknown
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
