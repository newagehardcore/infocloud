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
      prompt: `Analyze this news article and respond in JSON format with two fields:
1. "bias": political bias (must be exactly one of: "Left", "Liberal", "Centrist", "Conservative", "Right", "Unknown")
2. "keywords": array of 5-10 most important keywords or phrases

Article: ${text.substring(0, 1500)} // Limit length for efficiency

Respond with valid JSON only:`,
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
    console.error('LLM article processing failed:', error);
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
    if (retries > 0) {
      console.log(`Retrying LLM processing, ${retries} attempts remaining`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      return processArticleWithRetry(text, retries - 1);
    }
    console.error('All LLM processing retries failed');
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
