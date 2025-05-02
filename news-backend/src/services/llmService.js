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
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Process an article with LLM to extract both bias and keywords at once
 * Uses a single API call to improve efficiency
 * 
 * @param {string} text - The article text to analyze
 * @returns {Promise<Object>} - Object with bias and keywords
 */
async function processArticle(text) {
  // Skip empty text
  if (!text || text.trim().length === 0) {
    return {
      bias: PoliticalBias.Unknown,
      keywords: []
    };
  }

  const cacheKey = `article-${createHash(text)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'gemma:2b', // Fast, efficient model
      prompt: `You are an expert news analyst specialized in extracting narrative-focused phrases that tell the story of a news article. Your task is to identify the most meaningful multi-word phrases that capture the essence of the news.

      Analyze this news article and respond in JSON format with two fields:
      
      "bias": political bias (must be exactly one of: "Left", "Liberal", "Centrist", "Conservative", "Right", "Unknown")
      "keywords": array of 8-15 descriptive multi-word phrases that:
      
      CRITICAL: FAVOR MULTI-WORD PHRASES OVER SINGLE WORDS (at least 2-4 words each)
      Tell the story of the article through connected phrases
      Capture what happened, who was involved, and why it matters
      Create a narrative flow when read as a collection
      Avoid generic words or common phrases that don't add context
      Include proper names with their roles/context (e.g., "President Biden's inflation plan")
      
      PHRASE QUALITY REQUIREMENTS:
      
      1. Use noun phrases with descriptive adjectives or verb phrases showing action
      2. Include relationship indicators (e.g., "protests against police brutality" not just "protests")
      3. Capture cause-effect in a single phrase (e.g., "sanctions triggered economic collapse")
      4. For debates/conflicts, include opposing parties (e.g., "Democrats clash with Republicans over border")
      5. For policies/legislation, specify impact (e.g., "tax cuts benefit wealthy Americans")
      6. For events, include location and significance (e.g., "Michigan primary election results")
      7. For controversies, include the nature of the issue (e.g., "ethical concerns over AI surveillance")
      8. For financial news, include specific metrics (e.g., "30-year mortgage rates hit 7.2%")
      9. For political statements, include who and what (e.g., "Netanyahu defends military response")
      10. For scientific developments, include the breakthrough (e.g., "new cancer treatment shows 70% efficacy")
      
      MAKE YOUR PHRASES TELL A STORY:
      Think of each phrase as a headline or caption that captures a key aspect of the article.
      Someone reading just your extracted phrases should understand what the article is about.
      
      For bias detection:
      Use the same criteria as before, analyzing:
      - Language choices (loaded terms, emotional framing)
      - Balance of perspectives presented
      - Selection of facts and emphasis
      - Attribution patterns and narrative framing
      
      Article: ${text.substring(0, 1500)} // Limit length for efficiency
      Respond with valid JSON only in this exact format:
      {
        "bias": "[political bias category]",
        "keywords": ["descriptive phrase 1", "descriptive phrase 2", "descriptive phrase 3"]
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
          result.keywords.map(k => k.trim()).filter(k => k.length > 0) : []
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
 * @param {string} text - The article text to analyze
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object>} - Object with bias and keywords
 */
async function processArticleWithRetry(text, retries = 2) {
  try {
    return await processArticle(text);
  } catch (error) {
    // Check if it's a connection error (likely Ollama not running)
    if (error.code === 'ECONNREFUSED' && retries > 0) {
      console.log(`LLM connection failed. Retrying ${retries} more times...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      return processArticleWithRetry(text, retries - 1);
    } 
    // Other errors or out of retries
    else if (retries > 0) {
      console.log(`LLM error: ${error.message || 'Unknown error'}. Retrying ${retries} more times...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      return processArticleWithRetry(text, retries - 1);
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
  const normalized = biasString.toString().toLowerCase();
  if (normalized.includes('left')) return PoliticalBias.Left;
  if (normalized.includes('liberal')) return PoliticalBias.Liberal;
  if (normalized.includes('centrist')) return PoliticalBias.Centrist;
  if (normalized.includes('conservative')) return PoliticalBias.Conservative;
  if (normalized.includes('right')) return PoliticalBias.Right;
  return PoliticalBias.Unknown;
}

module.exports = {
  processArticle,
  processArticleWithRetry
};
