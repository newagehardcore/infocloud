// Updated RSS feeds with fixed URLs and removed broken ones
const DEFAULT_RSS_FEEDS = [
  // Conservative Sources
  {
    url: 'https://www.dailywire.com/feeds/rss.xml',
    name: 'The Daily Wire',
    category: NewsCategory.Politics,
    bias: PoliticalBias.AlternativeRight
  },
  {
    url: 'https://www.newsmax.com/rss/Politics/1/',
    name: 'Newsmax',
    category: NewsCategory.Politics,
    bias: PoliticalBias.MainstreamRepublican
  },
  {
    url: 'https://www.washingtontimes.com/rss/headlines/news/',
    name: 'Washington Times',
    category: NewsCategory.News,
    bias: PoliticalBias.MainstreamRepublican
  },
  {
    url: 'https://www.oann.com/feed/',
    name: 'One America News Network',
    category: NewsCategory.News,
    bias: PoliticalBias.AlternativeRight
  },
  {
    url: 'https://townhall.com/rss/political-cartoons/',
    name: 'Townhall',
    category: NewsCategory.Politics,
    bias: PoliticalBias.MainstreamRepublican
  },
  {
    url: 'https://www.redstate.com/feed/',
    name: 'RedState',
    category: NewsCategory.Politics,
    bias: PoliticalBias.MainstreamRepublican
  },
  {
    url: 'https://www.theblaze.com/feeds/feed.rss',
    name: 'The Blaze',
    category: NewsCategory.Politics,
    bias: PoliticalBias.AlternativeRight
  },
  {
    url: 'https://freebeacon.com/feed/',
    name: 'Washington Free Beacon',
    category: NewsCategory.Politics,
    bias: PoliticalBias.MainstreamRepublican
  },
  
  // Science & Technology
  { url: 'https://www.space.com/feeds/all', name: 'Space.com', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://phys.org/rss-feed/', name: 'Phys.org', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.scientificamerican.com/rss/all/', name: 'Scientific American', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.universetoday.com/feed/', name: 'Universe Today', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.planetary.org/planetary-radio/mat-kaplan-farewell', name: 'Planetary Society', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.livescience.com/feeds/all', name: 'Live Science', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://newscientist.com/feed/home/', name: 'New Scientist', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.engadget.com/rss.xml', name: 'Engadget', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },
  { url: 'https://feeds.feedburner.com/Mashable', name: 'Mashable', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },
  
  // Law & Politics
  { url: 'https://abovethelaw.com/feed/', name: 'Above the Law', category: NewsCategory.Law, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://insideclimatenews.org/feed/', name: 'InsideClimate News', category: NewsCategory.Environment, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.crimeonline.com/feed/', name: 'Crime Online', category: NewsCategory.Crime, bias: PoliticalBias.Centrist },
  { url: 'https://www.understandingwar.org/rss.xml', name: 'Institute for the Study of War', category: NewsCategory.Military, bias: PoliticalBias.Centrist },
  { url: 'https://www.poynter.org/feed/', name: 'Poynter', category: NewsCategory.Media, bias: PoliticalBias.Centrist },
  { url: 'https://www.longwarjournal.org/feed', name: 'Long War Journal', category: NewsCategory.Military, bias: PoliticalBias.Centrist },
  { url: 'https://mediaite.com/feed/', name: 'Mediaite', category: NewsCategory.Media, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://fair.org/feed/', name: 'FAIR', category: NewsCategory.Media, bias: PoliticalBias.AlternativeLeft },
  
  // International News
  { url: 'https://www.spiegel.de/international/index.rss', name: 'Der Spiegel International', category: NewsCategory.World, bias: PoliticalBias.Centrist },
  { url: 'https://www.theartnewspaper.com/rss', name: 'The Art Newspaper', category: NewsCategory.Arts, bias: PoliticalBias.Centrist },
  { url: 'https://www.thelancet.com/rssfeed/lancet_current.xml', name: 'The Lancet', category: NewsCategory.Health, bias: PoliticalBias.Centrist },
  
  // Finance & Markets
  { url: 'https://seekingalpha.com/market_currents.xml', name: 'Seeking Alpha - Market News', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  { url: 'https://www.nakedcapitalism.com/feed', name: 'Naked Capitalism', category: NewsCategory.Finance, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://news.mongabay.com/feed/', name: 'Mongabay', category: NewsCategory.Environment, bias: PoliticalBias.Centrist },
  
  // Arts & Culture
  { url: 'https://www.thisiscolossal.com/feed/', name: 'Colossal', category: NewsCategory.Arts, bias: PoliticalBias.Centrist },
  { url: 'https://cjr.org/feed', name: 'Columbia Journalism Review', category: NewsCategory.Media, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.artsy.net/rss/news', name: 'Artsy', category: NewsCategory.Arts, bias: PoliticalBias.Centrist },
  { url: 'https://www.niemanlab.org/feed/', name: 'Nieman Lab', category: NewsCategory.Media, bias: PoliticalBias.Centrist },
  { url: 'https://www.stereogum.com/feed/', name: 'Stereogum', category: NewsCategory.Music, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://hyperallergic.com/feed/', name: 'Hyperallergic', category: NewsCategory.Arts, bias: PoliticalBias.MainstreamDemocrat },
  
  // Additional News Sources
  { url: 'https://www.schneier.com/feed/atom/', name: 'Schneier on Security', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },
  { url: 'https://pitchfork.com/feed/feed-news/rss', name: 'Pitchfork', category: NewsCategory.Music, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.alternet.org/feeds/feed.rss', name: 'AlterNet', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://www.commondreams.org/rss.xml', name: 'Common Dreams', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://www.aim.org/feed/', name: 'Accuracy in Media (AIM)', category: NewsCategory.Media, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://gizmodo.com/rss', name: 'Gizmodo', category: NewsCategory.Tech, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://thebulwark.com/feed/', name: 'The Bulwark', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://deadspin.com/rss', name: 'Deadspin', category: NewsCategory.Sports, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.highsnobiety.com/feed/', name: 'Highsnobiety', category: NewsCategory.Fashion, bias: PoliticalBias.Centrist },
  { url: 'https://www.rappler.com/rss', name: 'Rappler', category: NewsCategory.World, bias: PoliticalBias.Centrist },
  { url: 'https://www.carbonbrief.org/feed', name: 'Carbon Brief', category: NewsCategory.Environment, bias: PoliticalBias.Centrist },
  { url: 'https://www.scotusblog.com/feed/', name: 'SCOTUSblog', category: NewsCategory.Law, bias: PoliticalBias.Centrist },
  { url: 'https://towardsdatascience.com/feed', name: 'Towards Data Science', category: NewsCategory.Tech, bias: PoliticalBias.Centrist },
  { url: 'https://www.marketwatch.com/rss/topstories', name: 'MarketWatch', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  { url: 'https://www.washingtonexaminer.com/tag/news.rss', name: 'Washington Examiner', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://thehill.com/rss/syndicator/19109', name: 'The Hill', category: NewsCategory.Politics, bias: PoliticalBias.Centrist },
  { url: 'https://www.quantamagazine.org/feed/', name: 'Quanta Magazine', category: NewsCategory.Science, bias: PoliticalBias.Centrist },
  { url: 'https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_articles', name: 'Investopedia', category: NewsCategory.Finance, bias: PoliticalBias.Centrist },
  { 
    url: 'https://www.economist.com/the-world-this-week/rss.xml',
    alternateUrl: 'https://www.economist.com/weeklyedition/rss.xml',
    name: 'The Economist',
    category: NewsCategory.World,
    bias: PoliticalBias.Centrist
  },
  {
    url: 'https://www.cbc.ca/rss/world',
    alternateUrl: 'https://www.cbc.ca/webfeed/rss/rss-world',
    name: 'CBC News - World',
    category: NewsCategory.World,
    bias: PoliticalBias.Centrist
  },
  {
    url: 'https://feeds.propublica.org/propublica/main',
    alternateUrl: 'https://www.propublica.org/feed/main',
    name: 'ProPublica',
    category: NewsCategory.Investigative,
    bias: PoliticalBias.MainstreamDemocrat
  },
  {
    url: 'https://www.lawfareblog.com/feed',
    alternateUrl: 'https://www.lawfareblog.com/rss.xml',
    name: 'Lawfare',
    category: NewsCategory.Law,
    bias: PoliticalBias.Centrist
  }
];

// Configure parser with better timeout and headers
const parser = new Parser({
  timeout: 30000, // Reduced to 30 seconds to fail faster
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'contentEncoded'],
      ['description', 'description']
    ]
  },
  defaultRSS: 2.0,
  maxRedirects: 5
});

// Add rate limiting and item count limits per source
const MAX_ITEMS_PER_SOURCE = 30; // Reduced from 50 to 30 for better balance
const MAX_ITEMS_PER_BIAS = 100; // Maximum items per political bias category

// Track items per bias category
let biasItemCounts = {
  [PoliticalBias.MainstreamDemocrat]: 0,
  [PoliticalBias.AlternativeLeft]: 0,
  [PoliticalBias.Centrist]: 0,
  [PoliticalBias.MainstreamRepublican]: 0,
  [PoliticalBias.AlternativeRight]: 0,
  [PoliticalBias.Unclear]: 0
};

const SOURCE_RATE_LIMITS = {
  default: MAX_ITEMS_PER_SOURCE,
  // Override limits for sources that tend to flood
  'Deadspin': 20,
  'Mashable': 20,
  'War on the Rocks': 20,
  'Space.com': 20,
  'Scientific American': 20,
  'New Scientist': 20,
  'The Art Newspaper': 20
};

// Helper to get rate limit for a source
const getSourceLimit = (sourceName) => {
  return SOURCE_RATE_LIMITS[sourceName] || SOURCE_RATE_LIMITS.default;
};

// Update mapRssItemToNewsItem to handle rate limiting
const mapRssItemToNewsItem = (item, feedConfig, currentCount) => {
  try {
    // Check if we've hit the rate limit for this source
    const sourceLimit = getSourceLimit(feedConfig.name);
    if (currentCount >= sourceLimit) {
      return null;
    }

    let title = item.title || '';
    let description = item.contentSnippet || item.content || item.description || '';
    let url = item.link || '';
    let publishedAt = item.isoDate || item.pubDate || new Date().toISOString();
    let sourceName = feedConfig.name;
    let sourceBias = feedConfig.bias;
    let articleCategory = feedConfig.category;

    // Basic validation
    if (!title || !url) {
      console.warn(`[RSS] Skipping item due to missing title or URL from ${sourceName}: ${item.title?.substring(0,50)}`);
      return null;
    }

    // Ensure URL is valid and absolute
    try {
      const parsedUrl = new URL(url);
      url = parsedUrl.href;
    } catch (e) {
      console.warn(`[RSS] Skipping item due to invalid URL from ${sourceName}: ${url}`);
      return null;
    }

    // Clean up title and description
    title = title.replace(/<[^>]*>?/gm, '').trim();
    description = description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();

    // Truncate description if excessively long
    const MAX_DESC_LENGTH = 500;
    if (description.length > MAX_DESC_LENGTH) {
      description = description.substring(0, MAX_DESC_LENGTH) + '...';
    }

    // Validate and format date
    try {
      publishedAt = new Date(publishedAt).toISOString();
    } catch (e) {
      publishedAt = new Date().toISOString();
    }

    // Generate unique ID
    const id = uuidv4();

    const newsItem = {
      id,
      title,
      description,
      url,
      source: {
        name: sourceName,
        bias: sourceBias,
      },
      publishedAt,
      category: articleCategory,
      keywords: [],
    };
    
    return newsItem;

  } catch (error) {
    console.error(`[RSS] Error mapping article from ${feedConfig.name}:`, error);
    return null;
  }
};

// Update processFeedItems to use bias-based rate limiting
const processFeedItems = (feed, feedConfig) => {
  if (!feed || !feed.items || feed.items.length === 0) {
    return [];
  }

  let processedCount = 0;
  const sourceLimit = getSourceLimit(feedConfig.name);
  const currentBiasCount = biasItemCounts[feedConfig.bias] || 0;
  
  // Sort items by date (newest first) before processing
  const sortedItems = feed.items.sort((a, b) => {
    const dateA = new Date(a.isoDate || a.pubDate || 0);
    const dateB = new Date(b.isoDate || b.pubDate || 0);
    return dateB - dateA;
  });
  
  const processedItems = [];
  
  for (const item of sortedItems) {
    // Check both source and bias limits
    if (processedCount >= sourceLimit) break;
    if (currentBiasCount >= MAX_ITEMS_PER_BIAS) break;
    
    const newsItem = mapRssItemToNewsItem(item, feedConfig, processedCount);
    if (newsItem) {
      processedItems.push(newsItem);
      processedCount++;
      biasItemCounts[feedConfig.bias] = (biasItemCounts[feedConfig.bias] || 0) + 1;
    }
  }
  
  return processedItems;
};

// Reset bias counts at the start of each fetch cycle
const resetBiasCounts = () => {
  biasItemCounts = {
    [PoliticalBias.MainstreamDemocrat]: 0,
    [PoliticalBias.AlternativeLeft]: 0,
    [PoliticalBias.Centrist]: 0,
    [PoliticalBias.MainstreamRepublican]: 0,
    [PoliticalBias.AlternativeRight]: 0,
    [PoliticalBias.Unclear]: 0
  };
};

// Update fetchAllRssNews to use bias tracking
const fetchAllRssNews = async () => {
  console.log(`[RSS Service] Starting fetch for ${DEFAULT_RSS_FEEDS.length} feeds.`);
  resetBiasCounts(); // Reset bias counts at start
  const allNewsItems = [];
  const db = getDB();
  const newsCollection = db.collection('newsitems');

  const feedPromises = DEFAULT_RSS_FEEDS.map(async (feedConfig) => {
    try {
      console.log(`[RSS Service] Fetching: ${feedConfig.name} (${feedConfig.url})`);
      const feed = await fetchFeedWithRetry(feedConfig);
      
      const mappedItems = processFeedItems(feed, feedConfig);
      
      const itemsWithKeywords = await Promise.all(
        mappedItems.map(async (item) => {
          item.keywords = await extractKeywords(item);
          return item;
        })
      );

      console.log(`[RSS Service] Fetched, mapped, and extracted keywords for ${itemsWithKeywords.length} items from ${feedConfig.name}`);
      
      if (itemsWithKeywords.length > 0) {
        try {
          const bulkOps = itemsWithKeywords.map(item => ({
            updateOne: {
              filter: { id: item.id },
              update: { $setOnInsert: item },
              upsert: true
            }
          }));
          
          if (bulkOps.length > 0) {
            const result = await newsCollection.bulkWrite(bulkOps, { ordered: false });
            console.log(`[DB] Upserted ${result.upsertedCount} new items from ${feedConfig.name}. Matched: ${result.matchedCount}`);
          }
        } catch (dbError) {
          console.error(`[DB] Error saving items from ${feedConfig.name}:`, dbError);
          if (dbError.code === 11000) {
            console.warn(`[DB] Duplicate key error encountered for ${feedConfig.name}. Some items might already exist.`);
          }
        }
        return itemsWithKeywords;
      }
      return [];
    } catch (error) {
      console.error(`[RSS Service] Error processing ${feedConfig.name} (${feedConfig.url}):`, error.message);
      return [];
    }
  });

  const results = await Promise.allSettled(feedPromises);
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allNewsItems.push(...result.value);
    }
  });

  console.log(`[RSS Service] Finished fetching. Total items processed (potential duplicates): ${allNewsItems.length}. Check DB logs for upsert counts.`);

  // Log bias distribution at the end
  console.log('[RSS Service] Final bias distribution:', biasItemCounts);
  
  return allNewsItems;
};

// Add retry logic for feed fetching with improved error handling
const fetchFeedWithRetry = async (feedConfig, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Add exponential backoff between retries
        const backoffTime = Math.min(Math.pow(2, attempt) * 1000, 10000); // Cap at 10 seconds
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        console.log(`[RSS Service] Retry attempt ${attempt} for ${feedConfig.name}`);
      }
      
      // Try alternative URL if main URL fails on subsequent attempts
      let urlToTry = feedConfig.url;
      if (attempt > 0 && feedConfig.alternateUrl) {
        urlToTry = feedConfig.alternateUrl;
        console.log(`[RSS Service] Trying alternate URL for ${feedConfig.name}: ${urlToTry}`);
      }
      
      return await parser.parseURL(urlToTry);
    } catch (error) {
      lastError = error;
      
      // Enhanced error logging
      const errorMessage = error.message || 'Unknown error';
      const statusCode = error.response?.status;
      console.error(`[RSS Service] Error fetching ${feedConfig.name} (Attempt ${attempt + 1}/${maxRetries + 1}):`, {
        error: errorMessage,
        statusCode,
        url: feedConfig.url
      });
      
      // Don't retry on certain errors
      if (
        error.message.includes('404') || 
        error.message.includes('410') || // Gone
        error.message.includes('Invalid XML')
      ) {
        break;
      }
      
      // For 403 errors, try with different headers on next attempt
      if (error.message.includes('403')) {
        parser.options.headers = {
          ...parser.options.headers,
          'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
          'Referer': new URL(feedConfig.url).origin
        };
      }
      
      if (attempt === maxRetries) {
        console.error(`[RSS Service] All retry attempts failed for ${feedConfig.name}`);
      }
    }
  }
  
  throw lastError;
}; 