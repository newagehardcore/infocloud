const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb'); // May still be needed if manipulating _id directly elsewhere, but likely not for queries now.
const { fetchNews } = require('../miniflux/fetchEntries');
const { aggregateKeywordsForCloud } = require('../services/wordProcessingService');
const { PoliticalBias } = require('../types');
const NewsItem = require('../models/NewsItem'); // Import the Mongoose model

// Target number of articles to return
const TARGET_ARTICLE_COUNT = 1000; 

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
      ? req.query.category 
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

    // --- Querying News Items (Parallel Queries per Bias) --- 
    const queryPromises = selectedBiases.map(bias => {
      const filter = {};
      if (categoryFilter) {
        filter['source.category'] = categoryFilter.toUpperCase();
      }
      filter.bias = bias; // Filter by the LLM-determined bias
      
      return NewsItem
        .find(filter)
        .sort({ publishedAt: -1 })
        .limit(limitPerBias)
        .exec();
    });

    const resultsByBias = await Promise.all(queryPromises);
    const combinedNews = resultsByBias.flat(); // Combine results from all queries

    // Re-sort the combined list by publication date (most recent first)
    combinedNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Apply final cap
    const finalNews = combinedNews.slice(0, TARGET_ARTICLE_COUNT);

    console.log(`Total items fetched: ${combinedNews.length}, returning: ${finalNews.length}`);

    // --- Aggregating Keywords for Tag Cloud ---
    const newsWithKeywords = finalNews.filter(item => item.keywords && item.keywords.length > 0);
    const wordsForCloud = aggregateKeywordsForCloud(newsWithKeywords, 500); 

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

// @route   POST api/news/fetch
// @desc    Manually trigger news fetch
// @access  Public
router.post('/fetch', async (req, res) => {
  try {
    console.log('[News Route] Manually triggering Miniflux news fetch...');
    
    // Use our new Miniflux integration
    const newsItems = await fetchNews();
    
    console.log(`[News Route] Miniflux fetch complete. ${newsItems.length} items processed.`);
    res.json({ success: true, count: newsItems.length });
  } catch (err) {
    console.error('[News Route] Error fetching news from Miniflux:', err.message);
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
