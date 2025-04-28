const axios = require('axios');
const Parser = require('rss-parser');
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs if needed
const { getDB } = require('../config/db');
const { extractKeywords } = require('../utils/keywordExtractor'); // Import keyword extractor
const { PoliticalBias } = require('../utils/biasAnalyzer');

const parser = new Parser();

// Define constants for bias and category based on NewsItem model structure
// (Replace string literals if you prefer importing constants from a shared file)
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

// Track items per bias category
let biasItemCounts = {
  [PoliticalBias.Left]: 0,
  [PoliticalBias.Liberal]: 0,
  [PoliticalBias.Centrist]: 0,
  [PoliticalBias.Conservative]: 0,
  [PoliticalBias.Right]: 0,
  [PoliticalBias.Unknown]: 0
};

// Reset bias counts at the start of each fetch cycle
const resetBiasCounts = () => {
  biasItemCounts = {
    [PoliticalBias.Left]: 0,
    [PoliticalBias.Liberal]: 0,
    [PoliticalBias.Centrist]: 0,
    [PoliticalBias.Conservative]: 0,
    [PoliticalBias.Right]: 0,
    [PoliticalBias.Unknown]: 0
  };
};

// Add these constants at the top with other constants
const MAX_ITEMS_PER_BIAS = 50; // Maximum number of items to keep per bias category
const BIAS_DISTRIBUTION_TARGET = {
  [PoliticalBias.Left]: 0.2,    // 20% left
  [PoliticalBias.Liberal]: 0.2, // 20% liberal
  [PoliticalBias.Centrist]: 0.2, // 20% centrist
  [PoliticalBias.Conservative]: 0.2, // 20% conservative
  [PoliticalBias.Right]: 0.2,   // 20% right
};

// Default RSS feeds (Adapted from frontend code search results)
const DEFAULT_RSS_FEEDS = [
  // === POLITICS ===
  // Left Sources
  { url: 'https://www.alternet.org/feeds/feed.rss', name: 'AlterNet', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://www.commondreams.org/feeds/feed.rss/', name: 'Common Dreams', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://www.motherjones.com/feed/', name: 'Mother Jones', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://www.democracynow.org/democracynow.rss', name: 'Democracy Now', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://www.thenation.com/feed/', name: 'The Nation', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://jacobin.com/feed', name: 'Jacobin', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://progressive.org/feed', name: 'The Progressive', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://thegrayzone.com/feed/', name: 'The Grayzone', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://www.mintpressnews.com/feed/', name: 'MintPress News', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://truthout.org/feed/', name: 'Truthout', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://www.counterpunch.org/feed/', name: 'CounterPunch', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://fair.org/feed/', name: 'FAIR', category: NewsCategory.Politics, bias: PoliticalBias.Left },
  { url: 'https://inthesetimes.com/feed/', name: 'In These Times', category: NewsCategory.Politics, bias: PoliticalBias.Left },

  // Liberal Sources
  { url: 'https://www.vox.com/rss/index.xml', name: 'Vox', category: NewsCategory.Politics, bias: PoliticalBias.Liberal },
  { url: 'https://talkingpointsmemo.com/feed/all', name: 'Talking Points Memo', category: NewsCategory.Politics, bias: PoliticalBias.Liberal },
  { url: 'https://slate.com/feeds/all.rss', name: 'Slate', category: NewsCategory.Politics, bias: PoliticalBias.Liberal },
  { url: 'https://newrepublic.com/feed', name: 'The New Republic', category: NewsCategory.Politics, bias: PoliticalBias.Liberal },

  // Centrist Sources
  { url: 'https://thehill.com/rss/syndicator/19109', name: 'The Hill', category: NewsCategory.Politics, bias: PoliticalBias.Centrist },
  { url: 'https://www.politico.com/rss/politicopicks.xml', name: 'Politico', category: NewsCategory.Politics, bias: PoliticalBias.Centrist },

  // Conservative Sources
  { url: 'https://www.newsmax.com/rss/Politics/1/', name: 'Newsmax', category: NewsCategory.Politics, bias: PoliticalBias.Conservative },
  { url: 'https://townhall.com/rss/political-cartoons/', name: 'Townhall', category: NewsCategory.Politics, bias: PoliticalBias.Conservative },
  { url: 'https://www.redstate.com/feed/', name: 'RedState', category: NewsCategory.Politics, bias: PoliticalBias.Conservative },
  { url: 'https://freebeacon.com/feed/', name: 'Washington Free Beacon', category: NewsCategory.Politics, bias: PoliticalBias.Conservative },
  { url: 'https://thebulwark.com/feed/', name: 'The Bulwark', category: NewsCategory.Politics, bias: PoliticalBias.Conservative },
  { url: 'https://www.washingtonexaminer.com/tag/news.rss', name: 'Washington Examiner', category: NewsCategory.Politics, bias: PoliticalBias.Conservative },

  // Right Sources
  { url: 'https://www.dailywire.com/feeds/rss.xml', name: 'The Daily Wire', category: NewsCategory.Politics, bias: PoliticalBias.Right },
  { url: 'https://www.theblaze.com/feeds/feed.rss', name: 'The Blaze', category: NewsCategory.Politics, bias: PoliticalBias.Right },
  { url: 'https://www.breitbart.com/feed/', name: 'Breitbart', category: NewsCategory.Politics, bias: PoliticalBias.Right },

  // === NEWS ===
  // Left Sources
  { url: 'https://www.rawstory.com/feed/', name: 'Raw Story', category: NewsCategory.News, bias: PoliticalBias.Left },
  { url: 'https://www.democracynow.org/democracynow.rss', name: 'Democracy Now News', category: NewsCategory.News, bias: PoliticalBias.Left },
  { url: 'https://truthout.org/latest/feed/', name: 'Truthout News', category: NewsCategory.News, bias: PoliticalBias.Left },

  // Liberal Sources
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', name: 'New York Times', category: NewsCategory.News, bias: PoliticalBias.Liberal },
  { url: 'https://feeds.washingtonpost.com/rss/world', name: 'Washington Post', category: NewsCategory.News, bias: PoliticalBias.Liberal },
  { url: 'https://www.theguardian.com/us/rss', name: 'The Guardian US', category: NewsCategory.News, bias: PoliticalBias.Liberal },
  { url: 'https://www.npr.org/rss/rss.php?id=1001', name: 'NPR News', category: NewsCategory.News, bias: PoliticalBias.Liberal },
  { url: 'https://www.cbsnews.com/latest/rss/main', name: 'CBS News', category: NewsCategory.News, bias: PoliticalBias.Liberal },
  { url: 'https://abcnews.go.com/abcnews/topstories', name: 'ABC News', category: NewsCategory.News, bias: PoliticalBias.Liberal },
  { url: 'https://rss.cnn.com/rss/cnn_topstories.rss', name: 'CNN', category: NewsCategory.News, bias: PoliticalBias.Liberal },
  { url: 'https://feeds.nbcnews.com/nbcnews/public/news', name: 'NBC News', category: NewsCategory.News, bias: PoliticalBias.Liberal },

  // Centrist Sources
  { url: 'https://www.reuters.com/rssfeed/topNews', name: 'Reuters Top News', category: NewsCategory.News, bias: PoliticalBias.Centrist },
  { url: 'https://www.usatoday.com/rss/', name: 'USA Today', category: NewsCategory.News, bias: PoliticalBias.Centrist },
  { url: 'https://apnews.com/rss', name: 'Associated Press', category: NewsCategory.News, bias: PoliticalBias.Centrist },
  { url: 'https://www.upi.com/rss/news/1/', name: 'UPI', category: NewsCategory.News, bias: PoliticalBias.Centrist },
  { url: 'https://www.csmonitor.com/rss/all.rss', name: 'Christian Science Monitor', category: NewsCategory.News, bias: PoliticalBias.Centrist },

  // Conservative Sources
  { url: 'https://www.washingtontimes.com/rss/headlines/news/', name: 'Washington Times', category: NewsCategory.News, bias: PoliticalBias.Conservative },
  { url: 'https://moxie.foxnews.com/google-publisher/latest.xml', name: 'Fox News', category: NewsCategory.News, bias: PoliticalBias.Conservative },
  { url: 'https://www.nationalreview.com/feed/', name: 'National Review', category: NewsCategory.News, bias: PoliticalBias.Conservative },
  { url: 'https://www.washingtonexaminer.com/tag/news.rss', name: 'Washington Examiner News', category: NewsCategory.News, bias: PoliticalBias.Conservative },

  // Right Sources
  { url: 'https://www.oann.com/feed/', name: 'One America News Network', category: NewsCategory.News, bias: PoliticalBias.Right },
  { url: 'https://www.newsmax.com/rss/Newsfront/1/', name: 'Newsmax News', category: NewsCategory.News, bias: PoliticalBias.Right },

  // === SCIENCE ===
  { url: 'https://www.space.com/feeds/all', name: 'Space.com', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.sciencedaily.com/rss/all.xml', name: 'Science Daily', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.scientificamerican.com/rss/all/', name: 'Scientific American', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.newscientist.com/feed/home/', name: 'New Scientist', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://phys.org/rss-feed/', name: 'Phys.org', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.nature.com/nature.rss', name: 'Nature', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.sciencemag.org/rss/news_current.xml', name: 'Science Magazine', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.popsci.com/feed/', name: 'Popular Science', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.livescience.com/feeds/all', name: 'Live Science', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.sciencenews.org/feed', name: 'Science News', category: NewsCategory.Science, bias: PoliticalBias.Centrist },

  // === TECH ===
  { url: 'https://www.wired.com/feed/rss', name: 'Wired', category: NewsCategory.Tech, bias: PoliticalBias.Liberal },
  { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', name: 'Ars Technica', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },
  { url: 'https://www.zdnet.com/news/rss.xml', name: 'ZDNet', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },
  { url: 'https://readwrite.com/feed/', name: 'ReadWrite', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },
  { url: 'https://www.cnet.com/rss/all/', name: 'CNET', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },
  { url: 'https://venturebeat.com/feed/', name: 'VentureBeat', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },

  // === FINANCE ===
  { url: 'https://seekingalpha.com/market_currents.xml', name: 'Seeking Alpha - Market News', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  { url: 'https://www.nakedcapitalism.com/feed', name: 'Naked Capitalism', category: NewsCategory.Finance, bias: PoliticalBias.Left },
  { url: 'https://www.marketwatch.com/rss/topstories', name: 'MarketWatch', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  { url: 'https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_articles', name: 'Investopedia', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', name: 'CNBC', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  { url: 'https://www.ft.com/rss/home/us', name: 'Financial Times', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  { url: 'https://www.bloomberg.com/feed/podcast/decrypted', name: 'Bloomberg', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  { url: 'https://www.wsj.com/xml/rss/3_7031.xml', name: 'Wall Street Journal', category: NewsCategory.Finance, bias: PoliticalBias.Conservative },
  { url: 'https://www.barrons.com/feed/rss?id=latest', name: 'Barrons', category: NewsCategory.Finance, bias: PoliticalBias.Conservative },
  { url: 'https://www.fool.com/a/feeds/foolwatch?format=rss2&id=foolwatch', name: 'Motley Fool', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },

  // === MUSIC ===
  { url: 'https://www.stereogum.com/feed/', name: 'Stereogum', category: NewsCategory.Music, bias: PoliticalBias.Liberal },
  { url: 'https://pitchfork.com/feed/feed-news/rss', name: 'Pitchfork', category: NewsCategory.Music, bias: PoliticalBias.Liberal },
  { url: 'https://www.rollingstone.com/music/feed/', name: 'Rolling Stone – Music', category: NewsCategory.Music, bias: PoliticalBias.Liberal },
  { url: 'https://www.billboard.com/feed/', name: 'Billboard', category: NewsCategory.Music, bias: PoliticalBias.Centrist },
  { url: 'https://www.nme.com/feed', name: 'NME', category: NewsCategory.Music, bias: PoliticalBias.Centrist },
  { url: 'https://www.consequence.net/feed/', name: 'Consequence of Sound', category: NewsCategory.Music, bias: PoliticalBias.Liberal },
  { url: 'https://www.spin.com/feed/', name: 'Spin', category: NewsCategory.Music, bias: PoliticalBias.Liberal },
  { url: 'https://www.npr.org/rss/rss.php?id=1039', name: 'NPR Music', category: NewsCategory.Music, bias: PoliticalBias.Centrist },
  { url: 'https://www.brooklynvegan.com/feed/', name: 'BrooklynVegan', category: NewsCategory.Music, bias: PoliticalBias.Centrist },

  // === SPORTS ===
  { url: 'https://deadspin.com/rss', name: 'Deadspin', category: NewsCategory.Sports, bias: PoliticalBias.Liberal },
  { url: 'https://api.foxsports.com/v1/rss?partnerKey=zBaFxRyGKCfxBagJG9b8pqLyndmvo7UU', name: 'Fox Sports', category: NewsCategory.Sports, bias: PoliticalBias.Centrist },
  { url: 'https://www.espn.com/espn/rss/news', name: 'ESPN', category: NewsCategory.Sports, bias: PoliticalBias.Centrist },
  { url: 'https://sports.yahoo.com/rss/', name: 'Yahoo Sports', category: NewsCategory.Sports, bias: PoliticalBias.Centrist },
  { url: 'https://www.cbssports.com/rss/headlines/', name: 'CBS Sports', category: NewsCategory.Sports, bias: PoliticalBias.Centrist },
  { url: 'https://www.sbnation.com/rss/current', name: 'SB Nation', category: NewsCategory.Sports, bias: PoliticalBias.Liberal },
  { url: 'https://theathletic.com/news/rss/', name: 'The Athletic', category: NewsCategory.Sports, bias: PoliticalBias.Centrist },
  { url: 'https://bleacherreport.com/articles/feed', name: 'Bleacher Report', category: NewsCategory.Sports, bias: PoliticalBias.Centrist },
  { url: 'https://www.si.com/rss/si_topstories.rss', name: 'Sports Illustrated', category: NewsCategory.Sports, bias: PoliticalBias.Centrist },
  { url: 'https://www.sportingnews.com/us/rss', name: 'Sporting News', category: NewsCategory.Sports, bias: PoliticalBias.Centrist },

  // === AI ===
  { url: 'https://blogs.nvidia.com/blog/category/deep-learning/feed/', name: 'NVIDIA AI Blog', category: NewsCategory.AI, bias: PoliticalBias.Centrist },
  { url: 'https://ai.googleblog.com/feeds/posts/default', name: 'Google AI Blog', category: NewsCategory.AI, bias: PoliticalBias.Centrist },
  { url: 'https://www.fast.ai/atom.xml', name: 'fast.ai', category: NewsCategory.AI, bias: PoliticalBias.Centrist },
  { url: 'https://research.fb.com/feed/', name: 'Meta AI Research', category: NewsCategory.AI, bias: PoliticalBias.Centrist },
  { url: 'https://huggingface.co/blog/feed.xml', name: 'Hugging Face Blog', category: NewsCategory.AI, bias: PoliticalBias.Centrist },
  { url: 'https://www.reddit.com/r/artificial/.rss', name: 'Reddit r/artificial', category: NewsCategory.AI, bias: PoliticalBias.Centrist },
  { url: 'https://www.analyticsvidhya.com/feed/', name: 'Analytics Vidhya', category: NewsCategory.AI, bias: PoliticalBias.Centrist },
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

// Add this function after the mapRssItemToNewsItem function
const balanceNewsByBias = async (newsCollection) => {
  console.log('[RSS Service] Balancing news items by political bias...');
  
  // Get current counts by bias
  const biasCounts = await newsCollection.aggregate([
    { $group: { _id: '$bias', count: { $sum: 1 } } }
  ]).toArray();
  
  const totalItems = biasCounts.reduce((sum, item) => sum + item.count, 0);
  const biasDistribution = {};
  
  // Calculate current distribution
  biasCounts.forEach(item => {
    biasDistribution[item._id] = item.count / totalItems;
  });
  
  console.log('[RSS Service] Current bias distribution:', biasDistribution);
  
  // For each bias category that exceeds its target percentage
  for (const [bias, currentRatio] of Object.entries(biasDistribution)) {
    const targetRatio = BIAS_DISTRIBUTION_TARGET[bias] || 0;
    if (currentRatio > targetRatio) {
      const excessCount = Math.ceil((currentRatio - targetRatio) * totalItems);
      if (excessCount > 0) {
        // Remove excess items, keeping the most recent ones
        await newsCollection.find({ bias })
          .sort({ publishedAt: -1 })
          .skip(MAX_ITEMS_PER_BIAS)
          .limit(excessCount)
          .forEach(async (doc) => {
            await newsCollection.deleteOne({ _id: doc._id });
          });
        
        console.log(`[RSS Service] Removed ${excessCount} excess items from ${bias} bias category`);
      }
    }
  }
};

// Add these functions after the balanceNewsByBias function
const calculateBiasMetrics = async (newsCollection) => {
  const metrics = {
    timestamp: new Date(),
    totalItems: 0,
    distribution: {},
    categoryBreakdown: {},
    recentTrends: {}
  };

  // Get total counts and distribution by bias
  const biasCounts = await newsCollection.aggregate([
    { $group: { _id: '$bias', count: { $sum: 1 } } }
  ]).toArray();

  metrics.totalItems = biasCounts.reduce((sum, item) => sum + item.count, 0);
  
  biasCounts.forEach(item => {
    metrics.distribution[item._id] = {
      count: item.count,
      percentage: (item.count / metrics.totalItems * 100).toFixed(2) + '%'
    };
  });

  // Get breakdown by category and bias
  const categoryBiasCounts = await newsCollection.aggregate([
    { $group: { 
      _id: { category: '$category', bias: '$bias' },
      count: { $sum: 1 }
    }}
  ]).toArray();

  categoryBiasCounts.forEach(item => {
    const category = item._id.category;
    const bias = item._id.bias;
    if (!metrics.categoryBreakdown[category]) {
      metrics.categoryBreakdown[category] = {};
    }
    metrics.categoryBreakdown[category][bias] = item.count;
  });

  // Calculate trends over the last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentBiasCounts = await newsCollection.aggregate([
    { $match: { publishedAt: { $gte: yesterday } } },
    { $group: { _id: '$bias', count: { $sum: 1 } } }
  ]).toArray();

  recentBiasCounts.forEach(item => {
    metrics.recentTrends[item._id] = item.count;
  });

  return metrics;
};

const logBiasMetrics = async (newsCollection) => {
  const metrics = await calculateBiasMetrics(newsCollection);
  
  console.log('\n=== News Bias Distribution Report ===');
  console.log(`Timestamp: ${metrics.timestamp}`);
  console.log(`Total Items: ${metrics.totalItems}\n`);
  
  console.log('Overall Distribution:');
  Object.entries(metrics.distribution).forEach(([bias, data]) => {
    console.log(`${bias}: ${data.count} articles (${data.percentage})`);
  });
  
  console.log('\nCategory Breakdown:');
  Object.entries(metrics.categoryBreakdown).forEach(([category, biases]) => {
    console.log(`\n${category}:`);
    Object.entries(biases).forEach(([bias, count]) => {
      console.log(`  ${bias}: ${count} articles`);
    });
  });
  
  console.log('\nLast 24 Hours Trends:');
  Object.entries(metrics.recentTrends).forEach(([bias, count]) => {
    console.log(`${bias}: ${count} new articles`);
  });
  
  console.log('\n=====================================\n');
  
  return metrics;
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

  // After all feeds are processed and before returning
  await balanceNewsByBias(newsCollection);
  await logBiasMetrics(newsCollection);
  
  console.log(`[RSS Service] Finished fetching, balancing, and monitoring. Total items processed: ${allNewsItems.length}`);
  return allNewsItems;
};


module.exports = {
  fetchAllRssNews,
  DEFAULT_RSS_FEEDS, // Export if needed elsewhere
};
