const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb'); // May still be needed if manipulating _id directly elsewhere, but likely not for queries now.
const {
  getKeywordCache
} = require('../services/wordProcessingService');
const { PoliticalBias } = require('../types');
const NewsItem = require('../models/NewsItem'); // Import the Mongoose model

// Target number of articles to return
const TARGET_ARTICLE_COUNT = 1000;

// Max words served for the tag cloud
const WORD_LIMIT = 500;

// The bias that appears most often in a word's biases array
function dominantBias(word) {
  if (!word.biases || word.biases.length === 0) return 'Unknown';
  const counts = {};
  let best = word.biases[0], bestN = 0;
  word.biases.forEach(b => {
    counts[b] = (counts[b] || 0) + 1;
    if (counts[b] > bestN) { best = b; bestN = counts[b]; }
  });
  return best;
}

/**
 * Pick up to `limit` words round-robin across dominant-bias buckets, so every
 * bias present in the candidate set gets representation instead of the most
 * common bias crowding the rest out. Input must be sorted by value desc;
 * within each bucket that order is preserved.
 */
function biasBalancedSelect(sortedWords, limit) {
  const buckets = new Map();
  sortedWords.forEach(w => {
    const b = dominantBias(w);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(w);
  });
  const bucketArrays = Array.from(buckets.values());
  const result = [];
  while (result.length < limit) {
    let took = false;
    for (const arr of bucketArrays) {
      if (arr.length > 0) {
        result.push(arr.shift());
        took = true;
        if (result.length >= limit) break;
      }
    }
    if (!took) break; // all buckets empty
  }
  return result;
}

/**
 * ALL view selection: give each category an equal slot allocation
 * (bias-balanced within the category), then fill any remaining slots with the
 * highest-frequency words overall. A word occupies one slot even if it spans
 * several categories.
 */
function categoryQuotaSelect(sortedWords, limit) {
  const cats = new Set();
  sortedWords.forEach(w => (w.categories || []).forEach(c => cats.add(c)));
  if (cats.size === 0) return sortedWords.slice(0, limit);

  const quota = Math.ceil(limit / cats.size);
  const chosen = new Map(); // text -> word

  cats.forEach(cat => {
    const candidates = sortedWords.filter(w =>
      !chosen.has(w.text) && w.categories && w.categories.includes(cat)
    );
    biasBalancedSelect(candidates, quota).forEach(w => chosen.set(w.text, w));
  });

  // Fill leftover capacity with top words overall
  for (const w of sortedWords) {
    if (chosen.size >= limit) break;
    if (!chosen.has(w.text)) chosen.set(w.text, w);
  }
  return Array.from(chosen.values()).slice(0, limit);
}

// Helper function to get all bias values (adjust if PoliticalBias enum location differs)
const ALL_BIAS_VALUES = Object.values(PoliticalBias);

// @route   GET api/news
// @desc    Get news items filtered by category, balanced across selected biases, capped at ~1000.
// @access  Public
// @query   category?: string - Filter by category (pass 'all' or omit for no filter)
// @query   bias?: string - Comma-separated list of biases (e.g., "Liberal,Centrist") or 'all'
// @query   source?: string - [DEPRECATED] Filter by source name
// @query   q?: string - [DEPRECATED] Search keywords in title/description
// @query   limit?: number - [DEPRECATED]
// @query   page?: number - [DEPRECATED]
// @query   sortBy?: string - [DEPRECATED - Always sorts by publishedAt desc]
// @query   sortOrder?: string - [DEPRECATED]
// @query   timeFilter?: string - [DEPRECATED - Prioritization replaces this]
router.get('/', async (req, res) => {
  try {
    // --- Determine Filters --- 
    const categoryFilter = (req.query.category && req.query.category.toLowerCase() !== 'all')
      ? req.query.category // Keep original case for comparison with enum potentially
      : null;

    let selectedBiases = [];
    if (req.query.bias && req.query.bias.toLowerCase() !== 'all') {
      selectedBiases = req.query.bias.split(',').filter(b => ALL_BIAS_VALUES.includes(b));
    } else {
      selectedBiases = ALL_BIAS_VALUES; // Default to all biases
    }

    const N = selectedBiases.length;
    if (N === 0) {
      // If no valid biases are selected (or list was empty), return empty results
      return res.json({ data: [], words: [] });
    }

    const limitPerBias = Math.ceil(TARGET_ARTICLE_COUNT / N);
    console.log(`Querying for category: ${categoryFilter || 'all'}, biases: ${selectedBiases.join(', ')}, limit/bias: ${limitPerBias}`);

    // Build strict 24-hour cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 1);
    console.log(`[GET /api/news] Enforcing strict 24h filter (cutoff: ${cutoffDate.toISOString()})`);

    // --- Querying News Items (Parallel Queries per Bias) --- 
    const queryPromises = selectedBiases.map(bias => {
      const filter = {
        llmProcessed: true,
        publishedAt: { $gte: cutoffDate } // SAFETY NET: Only recent items
      };

      if (categoryFilter) {
        // Effective category: per-article (LLM) category when present,
        // otherwise the source's category.
        const cat = categoryFilter.toUpperCase();
        filter.$or = [
          { category: cat },
          { category: null, 'source.category': cat } // null matches missing too
        ];
      }
      filter.bias = bias; // Filter by the LLM-determined bias

      return NewsItem
        .find(filter)
        .sort({ publishedAt: -1 })
        .limit(limitPerBias)
        .exec();
    });

    const resultsByBias = await Promise.all(queryPromises);
    let combinedNews = resultsByBias.flat(); // Combine results from all queries

    // Re-sort the combined list by publication date (most recent first)
    combinedNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Apply final cap
    const finalNews = combinedNews.slice(0, TARGET_ARTICLE_COUNT);

    console.log(`Total items fetched: ${combinedNews.length}, returning: ${finalNews.length}`);

    // --- Get Keywords for Tag Cloud from Global Cache --- 
    let wordsForCloud = [];
    const cachedKeywordsResult = getKeywordCache();

    if (cachedKeywordsResult && cachedKeywordsResult.data && cachedKeywordsResult.data.size > 0) {
      wordsForCloud = Array.from(cachedKeywordsResult.data.entries()).map(([text, keywordData]) => ({
        text,
        // Recency-decayed weight (see recencyWeight in wordProcessingService):
        // a burst of fresh coverage outranks an old story with more total articles
        value: keywordData.weight != null ? keywordData.weight : keywordData.count,
        biases: keywordData.biases || [],
        categories: keywordData.categories || [], // Ensure categories array is present
        categoryCounts: keywordData.categoryCounts || {},
        categoryWeights: keywordData.categoryWeights || {},
        types: keywordData.types || [], // Add types array for font differentiation
        typeWeights: keywordData.typeWeights || {} // Recency-weighted per-type totals for dominance
      }));

      wordsForCloud.sort((a, b) => b.value - a.value);

      if (categoryFilter) {
        // Single-category view: that category's words, sized by how often the
        // keyword appears in THIS category (so a word that's huge globally but
        // marginal here — e.g. "tesla" in MUSIC — doesn't dominate), bias-balanced.
        const upperCategoryFilter = categoryFilter.toUpperCase();
        const candidates = wordsForCloud
          .filter(word =>
            (word.categoryCounts && word.categoryCounts[upperCategoryFilter] > 0) ||
            (!Object.keys(word.categoryCounts || {}).length && word.categories &&
              word.categories.some(cat => cat.toUpperCase() === upperCategoryFilter))
          )
          .map(word => ({
            ...word,
            value: (word.categoryWeights && word.categoryWeights[upperCategoryFilter])
              || (word.categoryCounts && word.categoryCounts[upperCategoryFilter])
              || 1
          }))
          .sort((a, b) => b.value - a.value);
        wordsForCloud = biasBalancedSelect(candidates, WORD_LIMIT);
        console.log(`[GET /api/news] Category '${categoryFilter}': ${candidates.length} candidates -> ${wordsForCloud.length} bias-balanced words.`);
      } else {
        // ALL view: allocate slots per category so every category is
        // represented, bias-balancing within each; fill remainder globally.
        wordsForCloud = categoryQuotaSelect(wordsForCloud, WORD_LIMIT);
      }

      // Keep display order by frequency
      wordsForCloud.sort((a, b) => b.value - a.value);

      if (wordsForCloud.length > 0) {
        console.log(`[GET /api/news] Sample of wordsForCloud being sent (first 3):`, JSON.stringify(wordsForCloud.slice(0, 3), null, 2));
      }

      console.log(`[GET /api/news] Serving ${wordsForCloud.length} keywords from global cache (timestamp: ${cachedKeywordsResult.timestamp}).`);
    } else {
      console.log('[GET /api/news] Global keyword cache is empty or not yet populated. Returning empty keywords list.');
    }

    // Return the balanced, prioritized & capped data
    res.json({
      data: finalNews,
      words: wordsForCloud
    });

  } catch (err) {
    console.error('Error fetching news:', err.message, err.stack);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/news/by-tag
// @desc    Get news items where the headline (title) contains a specific tag
// @access  Public
// @query   tag: string - The tag to search for in the news item titles
router.get('/by-tag', async (req, res) => {
  try {
    const { tag, category } = req.query;

    if (!tag) {
      return res.status(400).json({ msg: 'Tag query parameter is required' });
    }

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Effective-category filter (per-article LLM category, source fallback)
    const cat = (category && category.toLowerCase() !== 'all') ? category.toUpperCase() : null;
    const catFilter = cat
      ? { $or: [{ category: cat }, { category: null, 'source.category': cat }] }
      : {};

    const fetch = (query) => NewsItem.find(query).sort({ publishedAt: -1 }).limit(100).exec();

    // Layered fallbacks so a tag shown in the cloud always resolves to articles:
    // 1. exact keyword within the category
    let newsItems = await fetch({ keywords: tag, llmProcessed: true, ...catFilter });
    // 2. case-insensitive keyword within the category
    if (newsItems.length === 0) {
      newsItems = await fetch({ keywords: { $regex: `^${escapeRegex(tag)}$`, $options: 'i' }, llmProcessed: true, ...catFilter });
    }
    // 3. tag text appearing in the title, within the category
    if (newsItems.length === 0) {
      newsItems = await fetch({ title: { $regex: escapeRegex(tag), $options: 'i' }, ...catFilter });
    }
    // 4. last resort: same lookups without the category restriction
    if (newsItems.length === 0 && cat) {
      newsItems = await fetch({ keywords: { $regex: `^${escapeRegex(tag)}$`, $options: 'i' }, llmProcessed: true });
      if (newsItems.length === 0) {
        newsItems = await fetch({ title: { $regex: escapeRegex(tag), $options: 'i' } });
      }
    }

    if (!newsItems || newsItems.length === 0) {
      return res.json([]);
    }

    // Defensive display-level dedupe: syndicated copies of the same article
    // (same URL, or same title on the same day) should appear once.
    const seen = new Set();
    const deduped = newsItems.filter(item => {
      const day = item.publishedAt ? new Date(item.publishedAt).toISOString().slice(0, 10) : '';
      const keys = [item.url, `${item.title}|${day}`];
      if (keys.some(k => k && seen.has(k))) return false;
      keys.forEach(k => k && seen.add(k));
      return true;
    });

    res.json(deduped);

  } catch (err) {
    console.error('Error fetching news items by tag:', err.message, err.stack);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/news/:id
// @desc    Get specific news item by its custom ID (url-timestamp)
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    // Use Mongoose Model findOne() - assuming 'id' is a field in your schema, not MongoDB's _id
    // If :id refers to the MongoDB _id, use findById(req.params.id) instead.
    const newsItem = await NewsItem.findOne({ id: req.params.id }).exec(); // Use the unique 'id' field

    if (!newsItem) {
      return res.status(404).json({ msg: 'News item not found' });
    }
    res.json(newsItem);
  } catch (err) {
    console.error('Error fetching news item by ID:', err.message);
    // Handle potential errors like invalid ID format if using ObjectId later
    // if (err.kind === 'ObjectId') {
    //    return res.status(404).json({ msg: 'News item not found (invalid ID format)' });
    // }
    res.status(500).send('Server Error');
  }
});

// @route   POST api/news/refresh-feeds
// @desc    Refresh feeds in Miniflux
// @access  Public
router.post('/refresh-feeds', async (req, res) => {
  try {
    console.log('[News Route] Triggering Miniflux feed refresh...');

    // Execute the refresh script using child_process
    const { exec } = require('child_process');
    const path = require('path');
    const REFRESH_SCRIPT_PATH = path.join(__dirname, '../miniflux/refreshFeeds.js');

    exec(`node ${REFRESH_SCRIPT_PATH}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error refreshing feeds: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
      }
      if (stderr) {
        console.error(`Refresh stderr: ${stderr}`);
      }
      console.log(stdout);
      res.json({ success: true, message: 'Feed refresh triggered successfully' });
    });
  } catch (err) {
    console.error('[News Route] Error refreshing Miniflux feeds:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/purge-database
// @desc    Delete all news items from the database
// @access  Public (Caution: No auth! Use with care)
router.post('/purge-database', async (req, res) => {
  console.warn('Received request to PURGE database...');
  try {
    // Use Mongoose Model deleteMany()
    const deleteResult = await NewsItem.deleteMany({});

    console.log(`Database purge complete. Deleted ${deleteResult.deletedCount} items.`);
    res.json({ success: true, deletedCount: deleteResult.deletedCount });

  } catch (err) {
    console.error('Error purging database:', err.message);
    res.status(500).json({ success: false, message: 'Server Error during purge.' });
  }
});

module.exports = router;
