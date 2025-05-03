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
// @query   timeFilter?: string - Filter by time ('24h')
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

    // --- Date Filtering ---
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (req.query.timeFilter === '24h') {
      // Strict 24-hour filter
      filter.publishedAt = { $gte: twentyFourHoursAgo.toISOString() };
    } else {
      // Default: Filter for the last week
      filter.publishedAt = { $gte: oneWeekAgo.toISOString() };
    }

    // --- Sorting --- 
    const sortBy = req.query.sortBy || 'publishedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };

    // --- Pagination --- 
    const limit = parseInt(req.query.limit, 10) || 20; // Default limit 20
    const page = parseInt(req.query.page, 10) || 1;   // Default page 1
    const skip = (page - 1) * limit;

    // Add a filter to ensure keywords exist and are not empty for aggregation purposes
    const aggregationFilter = {
      ...filter, // Keep existing filters
      keywords: { $exists: true, $ne: [] } // Ensure keywords field exists and is not an empty array
    };

    // --- Querying News Items --- 
    const news = await newsCollection
      .find(aggregationFilter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .toArray();

    // --- Aggregating Keywords for Tag Cloud ---
    // Aggregate keywords from the fetched news items for this specific request/filter
    const wordsForCloud = aggregateKeywordsForCloud(news, 500); // Use the new function, limit to 500 words

    // Optional: Get total count for pagination headers/info
    const totalItems = await newsCollection.countDocuments(aggregationFilter);
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
// @desc    Get news items related to a specific keyword, optionally filtered by time
// @access  Public
// @query   keyword: string - The keyword to search for
// @query   timeFilter?: string - Filter by time ('24h')
router.get('/related', async (req, res) => {
  const { keyword, timeFilter } = req.query; // Destructure timeFilter as well

  if (!keyword) {
    return res.status(400).json({ msg: 'Keyword query parameter is required' });
  }

  try {
    const db = getDB();
    const newsCollection = db.collection('newsitems');

    // Base query: Case-insensitive search for the keyword
    const query = {
      $or: [
        { title: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { keywords: { $regex: keyword, $options: 'i' } } 
      ]
    };
    
    // --- Date Filtering (same logic as /api/news) ---
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (timeFilter === '24h') {
      // Strict 24-hour filter
      query.publishedAt = { $gte: twentyFourHoursAgo.toISOString() };
    } else {
      // Default: Filter for the last week (to match default behavior of main endpoint)
      query.publishedAt = { $gte: oneWeekAgo.toISOString() };
    }

    // Find related news, apply date filter, sort by published date descending, limit results
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

// @route   POST /api/purge-database
// @desc    Delete all news items from the database
// @access  Public (Caution: No auth! Use with care)
router.post('/purge-database', async (req, res) => {
  console.warn('Received request to PURGE database...');
  try {
    const db = getDB();
    const newsCollection = db.collection('newsitems');
    
    // Delete all documents in the collection
    const deleteResult = await newsCollection.deleteMany({});
    
    console.log(`Database purge complete. Deleted ${deleteResult.deletedCount} items.`);
    res.json({ success: true, deletedCount: deleteResult.deletedCount });
    
  } catch (err) {
    console.error('Error purging database:', err.message);
    res.status(500).json({ success: false, message: 'Server Error during purge.' });
  }
});

module.exports = router;
