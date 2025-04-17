const axios = require('axios');
const Parser = require('rss-parser');
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs if needed
const { getDB } = require('../config/db');
const { extractKeywords } = require('../utils/keywordExtractor'); // Import keyword extractor

const parser = new Parser();

// Define constants for bias and category based on NewsItem model structure
// (Replace string literals if you prefer importing constants from a shared file)
const PoliticalBias = {
  AlternativeLeft: 'Alternative Left',
  MainstreamDemocrat: 'Mainstream Democrat',
  Centrist: 'Centrist',
  Unclear: 'Unclear',
  MainstreamRepublican: 'Mainstream Republican',
  AlternativeRight: 'Alternative Right',
};

const NewsCategory = {
  World: 'World',
  Politics: 'Politics',
  US: 'US',
  All: 'All', // Or a more specific default?
  Finance: 'Finance',
  Tech: 'Tech',
  Entertainment: 'Entertainment',
  Sports: 'Sports',
  Science: 'Science',
  Health: 'Health',
};

// Default RSS feeds (Adapted from frontend code search results)
const DEFAULT_RSS_FEEDS = [
  // Mainstream Democrat
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', name: 'New York Times', category: NewsCategory.World, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', name: 'New York Times Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR News', category: NewsCategory.US, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.vox.com/rss/world-politics/index.xml', name: 'Vox World Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.vanityfair.com/news/politics/rss', name: 'Vanity Fair Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.newyorker.com/feed/everything', name: 'The New Yorker', category: NewsCategory.All, bias: PoliticalBias.MainstreamDemocrat },
  // Alternative Left
  { url: 'https://www.motherjones.com/feed/', name: 'Mother Jones', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://fair.org/feed/', name: 'FAIR', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://truthout.org/latest/feed', name: 'Truthout', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://www.alternet.org/feeds/feed.rss', name: 'AlterNet', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://theintercept.com/feed/?rss', name: 'The Intercept', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://www.truthdig.com/feed/', name: 'Truthdig', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  // Centrist
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC News World', category: NewsCategory.World, bias: PoliticalBias.Centrist },
  { url: 'https://www.pbs.org/newshour/feeds/rss/headlines', name: 'PBS NewsHour', category: NewsCategory.US, bias: PoliticalBias.Centrist },
  // Mainstream Republican
  { url: 'https://www.washingtontimes.com/rss/headlines/news/world/', name: 'Washington Times World', category: NewsCategory.World, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://www.washingtontimes.com/rss/headlines/news/politics/', name: 'Washington Times Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://moxie.foxnews.com/google-publisher/world.xml', name: 'Fox News World', category: NewsCategory.World, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://moxie.foxnews.com/google-publisher/politics.xml', name: 'Fox News Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://moxie.foxnews.com/google-publisher/us.xml', name: 'Fox News US', category: NewsCategory.US, bias: PoliticalBias.MainstreamRepublican },
  { url: 'http://feeds.foxnews.com/foxnews/politics', name: 'Fox News Politics (Alt)', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://nypost.com/feed/', name: 'New York Post', category: NewsCategory.All, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://www.nationalreview.com/feed/', name: 'National Review', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },
  // Alternative Right
  { url: 'https://www.breitbart.com/feed/', name: 'Breitbart News', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'http://feeds.feedburner.com/breitbart', name: 'Breitbart News (Alt)', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://www.dailywire.com/feeds/rss.xml', name: 'The Daily Wire', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://dailycaller.com/feed/', name: 'The Daily Caller', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://www.theamericanconservative.com/feed/', name: 'The American Conservative', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://thepoliticalinsider.com/feed/', name: 'The Political Insider', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  // Business/Financial
  { url: 'https://www.economist.com/the-world-this-week/rss.xml', name: 'The Economist', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', name: 'CNBC World', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  // International Perspectives
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera', category: NewsCategory.World, bias: PoliticalBias.Unclear }, // Bias might vary
  { url: 'https://feeds.theguardian.com/theguardian/world/rss', name: 'The Guardian World', category: NewsCategory.World, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.dw.com/en/top-stories/rss', name: 'Deutsche Welle', category: NewsCategory.World, bias: PoliticalBias.Centrist },
  { url: 'https://www.france24.com/en/rss', name: 'France 24', category: NewsCategory.World, bias: PoliticalBias.Centrist },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', name: 'CNBC', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
];

/**
 * Maps an item from the rss-parser library to our NewsItem structure.
 * @param {object} item - Parsed item from rss-parser.
 * @param {object} feedConfig - The configuration object for the feed this item belongs to.
 * @returns {object | null} A NewsItem object or null if validation fails.
 */
const mapRssItemToNewsItem = (item, feedConfig) => {
  try {
    let title = item.title || '';
    let description = item.contentSnippet || item.content || item.summary || ''; // Prefer contentSnippet
    let url = item.link || '';
    let publishedAt = item.isoDate || item.pubDate || new Date().toISOString(); // Prefer isoDate

    // Basic validation
    if (!title || !url) {
      // console.warn(`[RSS] Skipping item due to missing title or URL from ${feedConfig.name}: ${item.title?.substring(0,50)}`);
      return null;
    }

    // Ensure URL is valid
    try {
      const parsedUrl = new URL(url);
      url = parsedUrl.href;
    } catch (e) {
      // console.warn(`[RSS] Skipping item due to invalid URL from ${feedConfig.name}: ${url}`);
      return null;
    }

    // Clean up (basic tag removal and whitespace normalization)
    title = title.replace(/<[^>]*>?/gm, '').trim();
    description = description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();

    // Truncate description
    const MAX_DESC_LENGTH = 500;
    if (description.length > MAX_DESC_LENGTH) {
      description = description.substring(0, MAX_DESC_LENGTH) + '...';
    }

    // Validate and format date
    try {
      publishedAt = new Date(publishedAt).toISOString();
    } catch (e) {
      publishedAt = new Date().toISOString(); // Fallback
    }

    // Generate a unique ID (using URL and publication time for potential deduplication)
    // Or use UUID if perfect uniqueness is needed and duplicates are handled elsewhere
    // const id = uuidv4();
    const id = `${url}-${publishedAt}`; 

    const newsItem = {
      id,
      title,
      description,
      url,
      source: {
        name: feedConfig.name,
        bias: feedConfig.bias,
      },
      publishedAt,
      category: feedConfig.category,
      keywords: [], // Keywords extracted later
      createdAt: new Date() // Timestamp of backend processing
    };
    
    return newsItem;

  } catch (error) {
    console.error(`[RSS] Error mapping article from ${feedConfig.name}:`, error);
    return null;
  }
};


/**
 * Fetches news from all configured RSS feeds.
 * TODO: Add category filtering.
 * TODO: Add keyword extraction call. - DONE
 * TODO: Add saving to database. - DONE
 */
const fetchAllRssNews = async () => {
  console.log(`[RSS Service] Starting fetch for ${DEFAULT_RSS_FEEDS.length} feeds.`);
  const allNewsItems = [];
  const db = getDB(); // Get database connection
  const newsCollection = db.collection('newsitems'); // Use collection name (e.g., 'newsitems')

  const feedPromises = DEFAULT_RSS_FEEDS.map(async (feedConfig) => {
    try {
      console.log(`[RSS Service] Fetching: ${feedConfig.name} (${feedConfig.url})`);
      const feed = await parser.parseURL(feedConfig.url);
      const mappedItems = feed.items
        .map(item => mapRssItemToNewsItem(item, feedConfig))
        .filter(item => item !== null); // Filter out items that failed mapping/validation

      // Extract keywords for successfully mapped items
      const itemsWithKeywords = await Promise.all(
          mappedItems.map(async (item) => {
            item.keywords = await extractKeywords(item);
            return item;
          })
      );

      console.log(`[RSS Service] Fetched, mapped, and extracted keywords for ${itemsWithKeywords.length} items from ${feedConfig.name}`);
      
      if (itemsWithKeywords.length > 0) {
        // Insert into DB (handle potential duplicates if needed)
        try {
           // Use updateMany with upsert to avoid duplicates based on the custom 'id' field
           const bulkOps = itemsWithKeywords.map(item => ({
             updateOne: {
               filter: { id: item.id }, // Use the custom id (url + publishedAt)
               update: { $setOnInsert: item }, // Only insert if 'id' doesn't exist
               upsert: true
             }
           }));
           if (bulkOps.length > 0) {
             const result = await newsCollection.bulkWrite(bulkOps, { ordered: false });
             console.log(`[DB] Upserted ${result.upsertedCount} new items from ${feedConfig.name}. Matched: ${result.matchedCount}`);
           }
        } catch (dbError) {
            console.error(`[DB] Error saving items from ${feedConfig.name}:`, dbError);
            // Handle specific errors like duplicate keys if not using upsert correctly
            if (dbError.code === 11000) {
              console.warn(`[DB] Duplicate key error encountered for ${feedConfig.name}. Some items might already exist.`);
            }
        }
        return itemsWithKeywords; // Return items with keywords
      }
      return [];
    } catch (error) {
      console.error(`[RSS Service] Error processing ${feedConfig.name} (${feedConfig.url}):`, error.message);
      // Log less severe errors like timeouts or parsing issues without stopping everything
      if (error.code === 'ECONNABORTED') {
          console.warn(`[RSS Service] Timeout fetching ${feedConfig.name}`);
      } else if (error.message.includes('Invalid XML') || error.message.includes('Non-whitespace before first tag')) {
          console.warn(`[RSS Service] Invalid XML or parsing error for ${feedConfig.name}`);
      }
      return []; // Return empty array on error for this feed
    }
  });

  // Wait for all feed processing attempts
  const results = await Promise.allSettled(feedPromises);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allNewsItems.push(...result.value);
    } else if (result.status === 'rejected') {
      // Errors are logged within the map function, but maybe log again here if needed
      console.error(`[RSS Service] Promise rejected for feed ${DEFAULT_RSS_FEEDS[index]?.name}: ${result.reason}`);
    }
  });

  console.log(`[RSS Service] Finished fetching. Total items processed (potential duplicates): ${allNewsItems.length}. Check DB logs for upsert counts.`);
  // Keyword extraction could happen here on allNewsItems before returning/final save
  // For now, just return the collected items
  return allNewsItems; 
};


module.exports = {
  fetchAllRssNews,
  DEFAULT_RSS_FEEDS, // Export if needed elsewhere
};
