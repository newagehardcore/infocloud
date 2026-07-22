const nlp = require('compromise');

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
    return result;
  } catch (error) {
    console.warn(`[TextUtils] Error lemmatizing "${word}":`, error);
    return word.toLowerCase(); // Fallback to original lowercase word on error
  }
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
 * Detects if a string is likely a proper noun (name, place, organization)
 */
const isProperNoun = (text) => {
  const doc = nlp(text);
  return doc.match('#ProperNoun').found;
};

module.exports = {
  lemmatizeWord,
  stripHtml,
  isProperNoun
}; 