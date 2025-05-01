const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb'); // Needed if querying by MongoDB's default _id
const { fetchNews } = require('../miniflux/fetchEntries'); // Use new Miniflux integration
const { aggregateKeywordsForCloud } = require('../services/wordProcessingService');

// @route   GET api/news
// @desc    Get news items with filtering, sorting, and pagination
// @access  Public
// @query   category?: string - Filter by category
// @query   source?: string - Filter by source name (e.g., "New York Times")
// @query   bias?: string - Filter by political bias (e.g., "Centrist")
// @query   q?: string - Search keywords in title/description (basic text search)
// @query   limit?: number - Number of items per page (default: 20)
// @query   page?: number - Page number (default: 1)
// @query   sortBy?: string - Field to sort by (default: publishedAt)
// @query   sortOrder?: string - Sort order ('asc' or 'desc', default: 'desc')
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const newsCollection = db.collection('newsitems');

    // --- Filtering --- 
    const filter = {};
    if (req.query.category) {
      filter.category = req.query.category; 
    }
    if (req.query.source) {
      // Case-insensitive search for source name
      filter['source.name'] = { $regex: new RegExp(`^${req.query.source}$`, 'i') };
    }
    if (req.query.bias) {
       filter['source.bias'] = req.query.bias;
    }
    // Basic text search (requires a text index on title/description in MongoDB for efficiency)
    // db.collection('newsitems').createIndex({ title: "text", description: "text" })
    if (req.query.q) {
      filter.$text = { $search: req.query.q };
    }

    // --- Sorting --- 
    const sortBy = req.query.sortBy || 'publishedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };

    // --- Pagination --- 
    const limit = parseInt(req.query.limit, 10) || 20; // Default limit 20
    const page = parseInt(req.query.page, 10) || 1;   // Default page 1
    const skip = (page - 1) * limit;

    // --- Querying News Items --- 
    const news = await newsCollection
      .find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .toArray();

    // --- Aggregating Keywords for Tag Cloud ---
    // Aggregate keywords from the fetched news items for this specific request/filter
    const wordsForCloud = aggregateKeywordsForCloud(news, 500); // Use the new function, limit to 500 words

    // Optional: Get total count for pagination headers/info
    const totalItems = await newsCollection.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      data: news,
      words: wordsForCloud,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      }
    });

  } catch (err) {
    console.error('Error fetching news:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/news/related
// @desc    Get news items related to a specific keyword
// @access  Public
// @query   keyword: string - The keyword to search for
router.get('/related', async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ msg: 'Keyword query parameter is required' });
  }

  try {
    const db = getDB();
    const newsCollection = db.collection('newsitems');

    // Case-insensitive search for the keyword in title, description, or keywords array
    const query = {
      $or: [
        { title: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { keywords: { $regex: keyword, $options: 'i' } } // Assumes keywords is an array of strings
      ]
    };

    // Find related news, sort by published date descending, limit results (e.g., 50)
    const relatedNews = await newsCollection
      .find(query)
      .sort({ publishedAt: -1 })
      .limit(50) // Limit the number of related articles returned
      .toArray();

    res.json(relatedNews);

  } catch (err) {
    console.error('Error fetching related news:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/news/:id
// @desc    Get specific news item by its custom ID (url-timestamp)
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const newsCollection = db.collection('newsitems');
    
    // The `id` we created is based on url+timestamp, not MongoDB's ObjectId
    const newsItem = await newsCollection.findOne({ id: req.params.id }); 

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

module.exports = router;
