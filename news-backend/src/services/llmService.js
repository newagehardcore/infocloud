/**
 * LLM Service for news article analysis
 * Handles bias detection and keyword extraction using local Ollama instance
 */
const axios = require('axios');
const crypto = require('crypto');
const { LRUCache } = require('lru-cache');
const { PoliticalBias } = require('../types');

// Configure caching
const cache = new LRUCache({ 
  max: 1000,
  ttl: 1000 * 60 * 60 * 24 // 24 hour cache
});

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
      model: 'llama3:8b', // Switch back to Llama 3 8B for quality
      format: "json", // Enforce JSON output format
      prompt: `You are a highly efficient news headline analyst. Your task is to extract the political bias and the 2-3 most central and distinct keywords or named entities from the provided headline and optional first sentence.

Analyze this input:
Headline: ${title}
First Sentence: ${firstSentence}

Respond ONLY with valid JSON containing two fields:

"bias": political bias (must be exactly one of: "Left", "Liberal", "Centrist", "Conservative", "Right", "Unknown")
"keywords": array of 2-3 UNIQUE and most central keywords/phrases that:

IMPORTANT KEYWORD GUIDELINES:
* SELECT only the 2-3 most critical keywords/named entities that define the CORE SUBJECT or EVENT.
* PRIORITIZE distinct concepts. AVOID synonyms or minor variations if another keyword captures the main idea.
* EXTRACT keywords DIRECTLY from the headline/sentence text.
* FOCUS ON specific proper nouns (people, organizations, places), core actions, or defining topics.
* VARY length (single words to multi-word phrases) only if necessary to capture a distinct central concept.
* MAINTAIN original capitalization where possible.

**AVOID:**
* More than 3 keywords.
* Redundant keywords covering the same core concept.
* Generic or uninformative words (e.g., "today", "report", "update", "says").
* Adding concepts not explicitly mentioned.
* Paraphrasing the original text.
* News source names unless they are the subject.
* HTML code or entities.
* Dates/times unless absolutely central to identifying the event (rare).
* Generic words without context (e.g., "statement", "issue").

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
        "keywords": ["central keyword 1", "central keyword 2"] // (or up to 3 if necessary)
      }`,
      stream: false
    });
    
    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(response.data.response);
      
      // Ensure result has the expected structure
      result = {
        bias: mapToPoliticalBias(result.bias || ''),
        keywords: Array.isArray(result.keywords) ? 
          result.keywords
            .map(k => k.trim().toLowerCase()) // Normalize to lowercase
            .filter(k => {
              const words = k.split(' ');
              // Accept 1-4 word phrases, rejecting empty strings
              return k.length > 0 && words.length >= 1 && words.length <= 4 && 
                // Filter out common generic phrases
                !['news', 'update', 'read more', 'latest', 'breaking'].includes(k) &&
                // Filter out single prepositions or articles
                !(words.length === 1 && ['and', 'the', 'of', 'to', 'in', 'for', 'with', 'on', 'by', 'at'].includes(k));
            })
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
  // In the future, this could read from config, but for now, reads the hardcoded value
  // This is a bit brittle, assumes the model line format doesn't change drastically
  try {
    const fileContent = require('fs').readFileSync(__filename, 'utf8');
    const modelLine = fileContent.split('\n').find(line => line.includes('model:'));
    const match = modelLine.match(/model:\s*'([^\']+)'/);
    // --- Update Model Name Reading Logic ---
    // Simple approach: Find the line with `model:` and extract the value.
    // This might need adjustment if the formatting changes significantly.
    if (match && match[1]) {
        return match[1];
    } else {
        // Fallback if regex fails
        const modelSettingLine = fileContent.split('\n').find(line => line.trim().startsWith('model:'));
        if (modelSettingLine) {
            const parts = modelSettingLine.split(':');
            if (parts.length > 1) {
                return parts[1].trim().replace(/['",]/g, '').split(' ')[0]; // Get model name, remove quotes/commas
            }
        }
        return 'unknown'; // Default if model line not found or parsed
    }
  } catch (err) {
    console.error("Error reading model name from llmService.js:", err);
    return 'error_reading_model';
  }
}

module.exports = {
  processArticle,
  processArticleWithRetry,
  getCurrentModelName
};
