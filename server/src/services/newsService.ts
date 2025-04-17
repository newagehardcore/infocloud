import axios from 'axios';
import nlp from 'compromise';
import { NewsItem, PoliticalBias, NewsCategory, TimeSnapshot, RssFeedConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';
import Parser from 'rss-parser';

// Instantiate RSS parser
const parser = new Parser();

// Get the API keys from environment variables
const NEWS_API_KEY = process.env.REACT_APP_NEWS_API_KEY;
const GNEWS_API_KEY = process.env.REACT_APP_GNEWS_API_KEY;
const THE_NEWS_API_KEY = process.env.REACT_APP_THE_NEWS_API_KEY;

// Default RSS feeds - uses imported RssFeedConfig
const DEFAULT_RSS_FEEDS: RssFeedConfig[] = [
  // Mainstream Democrat
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', name: 'New York Times', category: NewsCategory.News, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.washingtonpost.com/rss/politics', name: 'Washington Post Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR News', category: NewsCategory.News, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.vox.com/rss/world-politics/index.xml', name: 'Vox World Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamDemocrat },

  // Alternative Left
  { url: 'https://www.motherjones.com/feed/', name: 'Mother Jones', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://www.thenation.com/feed/', name: 'The Nation', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://theintercept.com/feed/?rss', name: 'The Intercept', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://www.truthdig.com/feed/', name: 'Truthdig', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },

  // Centrist
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC News World', category: NewsCategory.News, bias: PoliticalBias.Centrist },
  { url: 'https://www.pbs.org/newshour/feeds/rss/headlines', name: 'PBS NewsHour', category: NewsCategory.News, bias: PoliticalBias.Centrist },
  { url: 'https://www.reuters.com/rss/topNews', name: 'Reuters Top News', category: NewsCategory.News, bias: PoliticalBias.Centrist },

  // Mainstream Republican
  { url: 'https://www.washingtontimes.com/rss/headlines/news/world/', name: 'Washington Times World', category: NewsCategory.News, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://www.wsj.com/xml/rss/3_7085.xml', name: 'Wall Street Journal', category: NewsCategory.News, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://moxie.foxnews.com/google-publisher/world.xml', name: 'Fox News World', category: NewsCategory.News, bias: PoliticalBias.MainstreamRepublican },
  { url: 'http://feeds.foxnews.com/foxnews/politics', name: 'Fox News Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://nypost.com/feed/', name: 'New York Post', category: NewsCategory.News, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://www.nationalreview.com/feed/', name: 'National Review', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },

  // Alternative Right
  { url: 'https://www.breitbart.com/feed/', name: 'Breitbart News', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'http://feeds.feedburner.com/breitbart', name: 'Breitbart News (Alt)', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://www.dailywire.com/feeds/rss.xml', name: 'The Daily Wire', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://dailycaller.com/feed/', name: 'The Daily Caller', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://www.theamericanconservative.com/feed/', name: 'The American Conservative', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://thepoliticalinsider.com/feed/', name: 'The Political Insider', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },

  // Business/Economy
  { url: 'https://www.economist.com/the-world-this-week/rss.xml', name: 'The Economist', category: NewsCategory.Economy, bias: PoliticalBias.Centrist },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', name: 'CNBC World', category: NewsCategory.Economy, bias: PoliticalBias.Centrist },

  // International News
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera', category: NewsCategory.News, bias: PoliticalBias.Unclear },
  { url: 'https://feeds.theguardian.com/theguardian/world/rss', name: 'The Guardian World', category: NewsCategory.News, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://rss.dw.com/rdf/rss-en-all', name: 'Deutsche Welle News', category: NewsCategory.News, bias: PoliticalBias.Centrist },
  { url: 'https://timesofindia.indiatimes.com/rssfeeds_us/-2128936835.cms', name: 'Times of India', category: NewsCategory.News, bias: PoliticalBias.Centrist }
];

// News Source interface - any news API we add should implement this
interface NewsSource {
  fetchNews(requestedCategory: NewsCategory, onNewsReceived: (newsItems: NewsItem[]) => void): Promise<void>;
  getSourceName(): string;
}

// Helper function to map TheNewsAPI category to our internal NewsCategory
const mapTheNewsAPIToCategory = (apiCategory: string): NewsCategory | null => {
  const lowerCategory = apiCategory.toLowerCase();
  
  switch (lowerCategory) {
    case 'entertainment': return NewsCategory.Entertainment;
    case 'health': return NewsCategory.Health;
    case 'science': return NewsCategory.Science;
    case 'sports': return NewsCategory.Sports;
    case 'technology': return NewsCategory.Tech;
    case 'politics': return NewsCategory.Politics;
    case 'business': return NewsCategory.Economy;
    case 'environment': return NewsCategory.Environment;
    case 'crime': return NewsCategory.Crime;
    case 'law': return NewsCategory.Law;
    case 'war': return NewsCategory.War;
    case 'culture': return NewsCategory.Culture;
    case 'music': return NewsCategory.Music;
    case 'media': return NewsCategory.Media;
    case 'ai': 
    case 'artificial intelligence': return NewsCategory.AI;
    case 'space': return NewsCategory.Space;
    case 'fashion': return NewsCategory.Fashion;
    case 'art': return NewsCategory.Art;
    case 'general': return NewsCategory.News;
    default: return NewsCategory.News;
  }
};

// NewsAPI implementation
class NewsAPISource implements NewsSource {
  async fetchNews(requestedCategory: NewsCategory = NewsCategory.All, onNewsReceived: (newsItems: NewsItem[]) => void): Promise<void> {
    let validItems: NewsItem[] = [];
    try {
      if (!NEWS_API_KEY) {
        console.warn('No NewsAPI key found.');
        onNewsReceived([]);
        return;
      }

      // Map our category to NewsAPI category
      const apiCategory = mapCategoryToNewsAPI(requestedCategory);
      
      // Fetch real data from NewsAPI
      const response = await axios.get(
        `https://newsapi.org/v2/top-headlines?country=us${apiCategory ? `&category=${apiCategory}` : ''}`,
        { headers: { 'X-Api-Key': NEWS_API_KEY } }
      );

      if (!response.data.articles || response.data.articles.length === 0) {
        console.warn('No articles found from NewsAPI.');
        onNewsReceived([]);
        return;
      }

      // Map the API response, passing requestedCategory
      const mappedItems: (NewsItem | null)[] = await Promise.all(
        response.data.articles.map(async (article: any, index: number) => {
          // Pass requestedCategory to the mapping function
          const newsItem = mapArticleToNewsItem(article, index, 'NewsAPI', undefined, requestedCategory); 
          if (newsItem) {
            newsItem.keywords = await extractKeywords(newsItem);
          }
          return newsItem;
        })
      );
      
      // Filter out nulls
      validItems = mappedItems.filter((item): item is NewsItem => item !== null);
    } catch (error) {
      console.error('Error fetching news from NewsAPI:', error);
      validItems = [];
    } finally {
      onNewsReceived(validItems);
    }
  }

  getSourceName(): string {
    return 'NewsAPI';
  }
}

// GNews API implementation
class GNewsAPISource implements NewsSource {
  async fetchNews(requestedCategory: NewsCategory = NewsCategory.All, onNewsReceived: (newsItems: NewsItem[]) => void): Promise<void> {
    let processedItems: NewsItem[] = [];
    try {
      if (!GNEWS_API_KEY) {
        console.warn('No GNews API key found.');
        onNewsReceived([]);
        return;
      }

      // Map our category to GNews API topic
      const apiTopic = mapCategoryToGNews(requestedCategory);
      
      // Fetch data from GNews API
      const url = new URL('https://gnews.io/api/v4/top-headlines');
      url.searchParams.append('apikey', GNEWS_API_KEY);
      url.searchParams.append('lang', 'en');
      url.searchParams.append('country', 'us');
      url.searchParams.append('max', '10');
      
      if (apiTopic) {
        url.searchParams.append('topic', apiTopic);
      }
      
      const response = await axios.get(url.toString(), { 
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.data.articles || response.data.articles.length === 0) {
        onNewsReceived([]);
        return;
      }

      // Process articles, passing requestedCategory
      processedItems = await this.processArticles(response.data.articles, requestedCategory);
    } catch (error) {
      console.error('Error fetching news from GNews API:', error);
      processedItems = [];
    } finally {
      onNewsReceived(processedItems);
    }
  }

  private async processArticles(articles: any[], requestedCategory: NewsCategory): Promise<NewsItem[]> {
    const mappedItems: (NewsItem | null)[] = await Promise.all(
      articles.map(async (article: any, index: number) => {
        const gNewsArticle = {
          title: article.title,
          description: article.description || 'No description available',
          url: article.url,
          source: {
            name: article.source?.name || 'GNews',
            id: 'gnews'
          },
          publishedAt: article.publishedAt || article.published_at || new Date().toISOString(),
          section: article.topic || ''  // GNews uses 'topic' instead of 'section'
        };
        
        // Pass requestedCategory to the mapping function
        const newsItem = mapArticleToNewsItem(gNewsArticle, index, 'GNews', undefined, requestedCategory); 
        if (newsItem) {
          newsItem.keywords = await extractKeywords(newsItem);
        }
        return newsItem;
      })
    );
    // Filter out nulls
    return mappedItems.filter((item): item is NewsItem => item !== null);
  }

  getSourceName(): string {
    return 'GNews';
  }
}

// TheNewsAPI implementation
class TheNewsAPISource implements NewsSource {
  async fetchNews(requestedCategory: NewsCategory = NewsCategory.All, onNewsReceived: (newsItems: NewsItem[]) => void): Promise<void> {
    let processedItems: NewsItem[] = [];
    let articles: any[] = [];
    try {
      if (!THE_NEWS_API_KEY) {
        console.warn('No TheNewsAPI key found');
        onNewsReceived([]);
        return;
      }

      // Log detailed API key information for debugging
      console.log(`TheNewsAPI key length: ${THE_NEWS_API_KEY.length}, first/last chars: ${THE_NEWS_API_KEY.substring(0, 3)}...${THE_NEWS_API_KEY.substring(THE_NEWS_API_KEY.length - 3)}`);

      // Map our category to TheNewsAPI category
      const apiCategory = mapCategoryToTheNewsAPI(requestedCategory);
      
      // Try top news endpoint first
      const topNewsUrl = new URL('https://api.thenewsapi.com/v1/news/top');
      topNewsUrl.searchParams.append('api_token', THE_NEWS_API_KEY);
      topNewsUrl.searchParams.append('language', 'en');
      topNewsUrl.searchParams.append('limit', '10');
      // Add a broad search term to increase chances of getting results
      topNewsUrl.searchParams.append('search', 'today');
      
      if (apiCategory) {
        topNewsUrl.searchParams.append('categories', apiCategory);
      }
      
      try {
        const response = await axios.get(topNewsUrl.toString(), { timeout: 10000 });
        if (response.data && response.data.data && response.data.data.length > 0) {
          articles = articles.concat(response.data.data);
        } else {
          console.warn(`No articles found from TheNewsAPI top news for category ${apiCategory || 'all'}`);
        }
      } catch (error) {
        console.error(`Error fetching from TheNewsAPI top news for category ${apiCategory || 'all'}:`, error);
      }

      // Always try the 'all news' endpoint as a fallback or primary source
      const allNewsUrl = new URL('https://api.thenewsapi.com/v1/news/all');
      allNewsUrl.searchParams.append('api_token', THE_NEWS_API_KEY);
      allNewsUrl.searchParams.append('language', 'en');
      allNewsUrl.searchParams.append('limit', '10');
      allNewsUrl.searchParams.append('search', 'world news OR politics OR business');
      // Optionally add category filter here as well, but might be redundant
      if (apiCategory && apiCategory !== 'general') {
        allNewsUrl.searchParams.append('categories', apiCategory);
      }
      
      try {
        const response = await axios.get(allNewsUrl.toString(), { timeout: 10000 });
        if (response.data && response.data.data && response.data.data.length > 0) {
          // Simple de-duplication based on URL before adding
          const existingUrls = new Set(articles.map(a => a.url));
          const newArticles = response.data.data.filter((a: any) => !existingUrls.has(a.url));
          articles = articles.concat(newArticles);
        } else {
          console.warn(`No articles found from TheNewsAPI all news`);
        }
      } catch (error) {
        console.error(`Error fetching from TheNewsAPI all news:`, error);
      }

      if (articles.length === 0) {
        onNewsReceived([]);
        return;
      }

      // Process articles, passing requestedCategory
      processedItems = await this.processArticles(articles, requestedCategory);
    } catch (error) {
      console.error('Error fetching news from TheNewsAPI:', error);
      processedItems = [];
    } finally {
      onNewsReceived(processedItems);
    }
  }

  private async processArticles(articles: any[], requestedCategory: NewsCategory): Promise<NewsItem[]> {
    const mappedItems: (NewsItem | null)[] = await Promise.all(
      articles.map(async (article: any, index: number) => {
        const theNewsArticle = {
          title: article.title,
          description: article.description || article.snippet || 'No description available',
          url: article.url,
          source: {
            name: article.source || 'TheNewsAPI',
            id: 'thenewsapi'
          },
          publishedAt: article.published_at || article.publishedAt || new Date().toISOString(),
          categories: article.categories || [] // Map categories from TheNewsAPI
        };
        
        // Map TheNewsAPI category to our internal category
        const internalCategory = article.categories && article.categories.length > 0
                                  ? mapTheNewsAPIToCategory(article.categories[0])
                                  : null;
        
        // Use the mapped internal category if available, otherwise use requestedCategory
        const categoryToUse = internalCategory || requestedCategory;

        // Pass categoryToUse to the mapping function
        const newsItem = mapArticleToNewsItem(theNewsArticle, index, 'TheNewsAPI', undefined, categoryToUse); 
        if (newsItem) {
          newsItem.keywords = await extractKeywords(newsItem);
        }
        return newsItem;
      })
    );
    // Filter out nulls
    return mappedItems.filter((item): item is NewsItem => item !== null);
  }

  getSourceName(): string {
    return 'TheNewsAPI';
  }
}

// RSS implementation
class RSSSource implements NewsSource {
  async fetchNews(requestedCategory: NewsCategory = NewsCategory.All, onNewsReceived: (newsItems: NewsItem[]) => void): Promise<void> {
    try {
      // Filter feeds based on the requested category
      const relevantFeeds = DEFAULT_RSS_FEEDS.filter(
        feed => requestedCategory === NewsCategory.All || feed.category === requestedCategory
      );

      if (relevantFeeds.length === 0 && requestedCategory !== NewsCategory.All) {
        console.warn(`No RSS feeds configured for category: ${requestedCategory}`);
        onNewsReceived([]);
        return;
      }

      const feedsToFetch = requestedCategory === NewsCategory.All ? DEFAULT_RSS_FEEDS : relevantFeeds;
      const allRssItems: NewsItem[] = [];

      // Process all feeds concurrently
      const feedPromises = feedsToFetch.map(async (feedConfig) => {
        try {
          console.log(`[RSS] Fetching: ${feedConfig.name} (${feedConfig.url})`);
          const feed = await parser.parseURL(feedConfig.url);

          if (!feed || !feed.items || feed.items.length === 0) {
            console.warn(`[RSS] No items found or failed to parse: ${feedConfig.name}`);
            return [];
          }

          // Map items to NewsItem format
          const mappedItemsPromises = feed.items.map(async (item: Parser.Item) => {
            const newsItem = mapRssItemToNewsItem(item, feedConfig);
            if (newsItem) {
              newsItem.keywords = await extractKeywords(newsItem);
            }
            return newsItem;
          });

          const mappedItems = await Promise.all(mappedItemsPromises);
          return mappedItems.filter((item): item is NewsItem => item !== null);
        } catch (error) {
          console.error(`[RSS] Error processing ${feedConfig.name} (${feedConfig.url}):`, error);
          return [];
        }
      });

      // Wait for all feeds to be processed
      const results = await Promise.allSettled(feedPromises);

      // Collect successful results
      results.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allRssItems.push(...result.value);
        }
      });

      // Deduplicate by URL
      const uniqueUrls = new Set<string>();
      const uniqueItems = allRssItems.filter(item => {
        if (!uniqueUrls.has(item.url)) {
          uniqueUrls.add(item.url);
          return true;
        }
        return false;
      });

      console.log(`[RSS] Completed processing. Found ${uniqueItems.length} unique items.`);
      onNewsReceived(uniqueItems);
    } catch (error) {
      console.error('[RSS] Error in fetchNews:', error);
      onNewsReceived([]);
    }
  }

  getSourceName(): string {
    return 'RSS';
  }
}

// Helper to check if an API should be fetched based on env vars (optional)
// Example: process.env.ENABLE_NEWS_API === 'true'
// Default to true if the env var isn't set
const isApiEnabled = (apiName: string, defaultValue: boolean = true): boolean => {
  const envVar = process.env[`ENABLE_${apiName.toUpperCase()}`];
  return envVar ? envVar.toLowerCase() === 'true' : defaultValue;
};

// Orchestrates fetching from multiple sources concurrently
const fetchNewsFromAPI = async (
  requestedCategory: NewsCategory = NewsCategory.All,
  onNewsReceived: (newsItems: NewsItem[]) => void
): Promise<void> => {
  const allNewsItems: NewsItem[] = [];
  let promises: Promise<void>[] = [];
  let completedSources = 0;
  let totalSources = 0;

  const sources: NewsSource[] = [];

  // Conditionally add sources based on env vars or configuration
  if (isApiEnabled('NEWSAPI') && NEWS_API_KEY) {
      sources.push(new NewsAPISource());
  } else if (!NEWS_API_KEY) {
      console.warn("NewsAPI key missing, source disabled.");
  } else {
      console.log("NewsAPI source disabled by environment variable.");
  }
  
  if (isApiEnabled('GNEWS') && GNEWS_API_KEY) {
      sources.push(new GNewsAPISource());
  } else if (!GNEWS_API_KEY) {
      console.warn("GNews API key missing, source disabled.");
  } else {
      console.log("GNews API source disabled by environment variable.");
  }
  
  if (isApiEnabled('THENEWSAPI') && THE_NEWS_API_KEY) {
      sources.push(new TheNewsAPISource());
  } else if (!THE_NEWS_API_KEY) {
      console.warn("TheNewsAPI key missing, source disabled.");
  } else {
      console.log("TheNewsAPI source disabled by environment variable.");
  }
  
  if (isApiEnabled('RSS')) { // Assuming RSS is always enabled unless explicitly disabled
      sources.push(new RSSSource());
  } else {
      console.log("RSS source disabled by environment variable.");
  }

  totalSources = sources.length;

  if (totalSources === 0) {
    console.warn("No news sources are enabled or configured.");
    onNewsReceived([]);
    return;
  }

  // Create a callback for each source to collect results
  const sourceCallback = (batchItems: NewsItem[]) => {
    // Basic deduplication by URL before adding to the main list
    const existingUrls = new Set(allNewsItems.map(item => item.url));
    const uniqueNewItems = batchItems.filter(item => !existingUrls.has(item.url));
    allNewsItems.push(...uniqueNewItems);
    completedSources++;

    console.log(`Received ${batchItems.length} items (${uniqueNewItems.length} unique). Total items: ${allNewsItems.length}. Sources completed: ${completedSources}/${totalSources}`);

    // Check if all sources have reported back
    if (completedSources === totalSources) {
      console.log(`All ${totalSources} sources finished. Final item count: ${allNewsItems.length}`);
      onNewsReceived(allNewsItems);
    }
  };

  // Start fetching from all enabled sources
  sources.forEach(source => {
      console.log(`Starting fetch from ${source.getSourceName()} for category: ${requestedCategory}`);
      const promise = source.fetchNews(requestedCategory, sourceCallback)
          .catch(error => {
              console.error(`Error in fetchNews promise for ${source.getSourceName()}:`, error);
              // Ensure completion count is still incremented even on error
              completedSources++; 
              if (completedSources === totalSources) {
                  console.log(`All ${totalSources} sources finished (with errors). Final item count: ${allNewsItems.length}`);
                  onNewsReceived(allNewsItems); 
              }
          });
      promises.push(promise);
  });

  // Note: We don't necessarily wait for all promises here because the callback handles completion.
  // However, you might want overall timeout handling.
};

// Fetches all news items and returns them as a single array
const fetchAllNewsItems = async (
  requestedCategory: NewsCategory = NewsCategory.All
): Promise<NewsItem[]> => {
  return new Promise((resolve) => {
    const allItems: NewsItem[] = [];
    let promisesFinished = 0;
    let totalPromises = 0; // Will be set later

    const handleBatchReceived = (newsItemsBatch: NewsItem[]) => {
        const uniqueItems = newsItemsBatch.filter(newItem => 
            !allItems.some(existingItem => existingItem.url === newItem.url)
        );
        allItems.push(...uniqueItems);
        promisesFinished++;
        console.log(`Batch received: ${newsItemsBatch.length} (${uniqueItems.length} unique). Total: ${allItems.length}. Finished: ${promisesFinished}/${totalPromises}`);
        if (promisesFinished === totalPromises) {
            console.log(`fetchAllNewsItems completed. Total unique items: ${allItems.length}`);
            resolve(allItems);
        }
    };

    // Reuse fetchNewsFromAPI logic but adapt the callback
    fetchNewsFromAPI(requestedCategory, handleBatchReceived)
      .then(() => {
          // This block might not be strictly necessary if fetchNewsFromAPI's callback handles all completion logic
          // However, we need to know the total number of sources to correctly resolve the promise
          // Let's refine how totalPromises is determined. fetchNewsFromAPI should ideally expose this.
          // For now, assume the callback logic inside fetchNewsFromAPI correctly resolves.
          // The promise returned by fetchAllNewsItems resolves when the *last* batch is received.
      })
      .catch(error => {
          console.error("Error during fetchAllNewsItems orchestration:", error);
          resolve(allItems); // Resolve with potentially partial data on error
      });

    // Hacky way to determine totalPromises - needs improvement
    // Ideally fetchNewsFromAPI returns the count or the callback signals completion
    setTimeout(() => {
        // Infer totalPromises based on how many sources are expected to run
        // This relies on the internal logic of fetchNewsFromAPI based on API keys
        let expectedSources = 0;
        if (isApiEnabled('NEWSAPI') && NEWS_API_KEY) expectedSources++;
        if (isApiEnabled('GNEWS') && GNEWS_API_KEY) expectedSources++;
        if (isApiEnabled('THENEWSAPI') && THE_NEWS_API_KEY) expectedSources++;
        if (isApiEnabled('RSS')) expectedSources++;
        totalPromises = expectedSources;
        console.log(`fetchAllNewsItems: Determined expected sources: ${totalPromises}`);
        if (promisesFinished === totalPromises && totalPromises > 0) {
            console.log(`fetchAllNewsItems resolving immediately after determining total promises.`);
            resolve(allItems);
        } else if (totalPromises === 0) {
            console.warn("fetchAllNewsItems: No sources enabled, resolving empty.");
            resolve([]);
        }
    }, 100); // Small delay to allow fetchNewsFromAPI to initialize sources

  });
};

// --- Category Mapping Helpers ---

const mapCategoryToNewsAPI = (category: NewsCategory): string | null => {
  switch (category) {
    case NewsCategory.Entertainment: return 'entertainment';
    case NewsCategory.Health: return 'health';
    case NewsCategory.Science: return 'science';
    case NewsCategory.Sports: return 'sports';
    case NewsCategory.Tech: return 'technology';
    case NewsCategory.Politics: return 'politics';
    case NewsCategory.Economy: return 'business';
    case NewsCategory.Environment: return 'environment';
    case NewsCategory.Crime: return 'crime';
    case NewsCategory.Law: return 'law';
    case NewsCategory.War: return 'war';
    case NewsCategory.Culture: return 'culture';
    case NewsCategory.Music: return 'music';
    case NewsCategory.Media: return 'media';
    case NewsCategory.AI: return 'technology';
    case NewsCategory.Space: return 'science';
    case NewsCategory.Fashion: return 'fashion';
    case NewsCategory.Art: return 'art';
    case NewsCategory.News: return 'general';
    case NewsCategory.All: return 'general';
    default: return null;
  }
};

const mapCategoryToGNews = (category: NewsCategory): string | null => {
  switch (category) {
    case NewsCategory.Entertainment: return 'entertainment';
    case NewsCategory.Health: return 'health';
    case NewsCategory.Science: return 'science';
    case NewsCategory.Sports: return 'sports';
    case NewsCategory.Tech: return 'tech';
    case NewsCategory.Politics: return 'nation';
    case NewsCategory.Economy: return 'business';
    case NewsCategory.News: return 'general';
    case NewsCategory.All: return 'general';
    default: return null;
  }
};

const mapCategoryToTheNewsAPI = (category: NewsCategory): string | null => {
  switch (category) {
    case NewsCategory.Entertainment: return 'entertainment';
    case NewsCategory.Health: return 'health';
    case NewsCategory.Science: return 'science';
    case NewsCategory.Sports: return 'sports';
    case NewsCategory.Tech: return 'tech';
    case NewsCategory.Politics: return 'politics';
    case NewsCategory.Economy: return 'business';
    case NewsCategory.Environment: return 'environment';
    case NewsCategory.Crime: return 'crime';
    case NewsCategory.Law: return 'law';
    case NewsCategory.War: return 'war';
    case NewsCategory.Culture: return 'culture';
    case NewsCategory.Music: return 'music';
    case NewsCategory.Media: return 'media';
    case NewsCategory.AI: return 'tech';
    case NewsCategory.Space: return 'science';
    case NewsCategory.Fashion: return 'fashion';
    case NewsCategory.Art: return 'art';
    case NewsCategory.News: return 'general';
    case NewsCategory.All: return 'general';
    default: return null;
  }
};

// --- Core Data Mapping and Processing ---

// Maps various article formats (API or RSS) to our standard NewsItem
const mapArticleToNewsItem = (
  article: any, 
  index: number, 
  apiSource: string, 
  feedConfig?: RssFeedConfig, // Include feed config for RSS sources
  requestedCategory?: NewsCategory // Category used for the fetch request
): NewsItem | null => {
  try {
    let title = article.title || '';
    let description = article.description || article.content || article.contentSnippet || article.summary || '';
    let url = article.url || article.link || '';
    let publishedAt = article.publishedAt || article.pubDate || article.isoDate || new Date().toISOString();
    let sourceName = 'Unknown Source';
    let sourceBias = PoliticalBias.Unclear;
    let articleCategory = NewsCategory.All; // Default category

    // --- Source Name and Bias Determination ---
    if (apiSource === 'RSS' && feedConfig) {
      sourceName = feedConfig.name;
      sourceBias = feedConfig.bias;
      articleCategory = feedConfig.category; // Use feed's category for RSS
    } else if (apiSource === 'NewsAPI') {
      sourceName = article.source?.name || 'NewsAPI';
      sourceBias = analyzeMediaBias(sourceName);
      // Use requested category for APIs if article doesn't specify one we can map
      articleCategory = requestedCategory || NewsCategory.All; 
    } else if (apiSource === 'GNews') {
      sourceName = article.source?.name || 'GNews';
      sourceBias = analyzeMediaBias(sourceName);
      // GNews uses 'topic', map it if possible, otherwise use requested
      const topic = article.topic?.toLowerCase();
      if (topic === 'world') articleCategory = NewsCategory.News;
      else if (topic === 'nation') articleCategory = NewsCategory.News;
      else if (topic === 'business') articleCategory = NewsCategory.Economy;
      else if (topic === 'technology') articleCategory = NewsCategory.Tech;
      else if (topic === 'entertainment') articleCategory = NewsCategory.Entertainment;
      else if (topic === 'sports') articleCategory = NewsCategory.Sports;
      else if (topic === 'science') articleCategory = NewsCategory.Science;
      else if (topic === 'health') articleCategory = NewsCategory.Health;
      else articleCategory = requestedCategory || NewsCategory.All;
    } else if (apiSource === 'TheNewsAPI') {
      sourceName = article.source || 'TheNewsAPI';
      sourceBias = analyzeMediaBias(sourceName);
      // TheNewsAPI provides 'categories', try mapping the first one
      if (article.categories && article.categories.length > 0) {
        const mappedCat = mapTheNewsAPIToCategory(article.categories[0]);
        if (mappedCat) {
          articleCategory = mappedCat;
        } else {
          articleCategory = requestedCategory || NewsCategory.All;
        }
      } else {
        articleCategory = requestedCategory || NewsCategory.All;
      }
    }
    
    // Basic validation
    if (!title || !url) {
      // console.warn(`Skipping article due to missing title or URL from ${apiSource}: ${JSON.stringify(article)}`);
      return null;
    }

    // Ensure URL is valid and absolute
    try {
      const parsedUrl = new URL(url);
      url = parsedUrl.href;
    } catch (e) {
      // console.warn(`Skipping article due to invalid URL from ${apiSource}: ${url}`);
      return null;
    }

    // Clean up title and description (remove HTML tags, excessive whitespace)
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
      publishedAt = new Date().toISOString(); // Fallback to current time
    }

    // Generate unique ID
    const id = uuidv4();

    // Create the NewsItem object
    const newsItem: NewsItem = {
      id,
      title,
      description,
      url,
      source: {
        name: sourceName,
        bias: sourceBias,
      },
      publishedAt,
      category: articleCategory, // Assign the determined category
      keywords: [], // Keywords will be added later
    };
    
    // console.log("Mapped item:", JSON.stringify(newsItem, null, 2));
    return newsItem;

  } catch (error) {
    console.error(`Error mapping article from ${apiSource}:`, error, `Article data: ${JSON.stringify(article).substring(0, 500)}...`);
    return null;
  }
};

// Maps RSS item format to our standard NewsItem
const mapRssItemToNewsItem = (
  item: Parser.Item, 
  feedConfig: RssFeedConfig
): NewsItem | null => {
  try {
    let title = item.title || '';
    // Use contentSnippet (from rss-parser) or description, fallback to content
    let description = item.contentSnippet || (item as any).description || item.content || ''; 
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

    // Clean up title and description (remove HTML tags, excessive whitespace)
    // Note: rss-parser often provides cleaned content in contentSnippet
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
      publishedAt = new Date().toISOString(); // Fallback to current time
    }

    // Generate unique ID
    const id = uuidv4();

    // Create the NewsItem object
    const newsItem: NewsItem = {
      id,
      title,
      description,
      url,
      source: {
        name: sourceName,
        bias: sourceBias,
      },
      publishedAt,
      category: articleCategory, // Assign the determined category
      keywords: [], // Keywords will be added later
    };
    
    return newsItem;

  } catch (error) {
    console.error(`[RSS] Error mapping article from ${feedConfig.name}:`, error, `Article data: ${JSON.stringify(item).substring(0, 300)}...`);
    return null;
  }
};

// Extracts keywords using compromise NLP library
const extractKeywords = async (newsItem: NewsItem): Promise<string[]> => {
  const decodeHtml = (html: string): string => {
    if (typeof html !== 'string') return '';
    return html.replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#039;/g, "'")
               .replace(/&#8211;/g, "–") // en dash
               .replace(/&#8212;/g, "—") // em dash
               .replace(/&#8216;/g, "‘") // left single quote
               .replace(/&#8217;/g, "’") // right single quote
               .replace(/&#8220;/g, "“") // left double quote
               .replace(/&#8221;/g, "”") // right double quote
               .replace(/&nbsp;/g, ' '); // non-breaking space
  };
  
  try {
    const textToAnalyze = `${decodeHtml(newsItem.title)}. ${decodeHtml(newsItem.description)}`;
    const doc = nlp(textToAnalyze);

    let keywords = doc.nouns().out('array');
    const topics = doc.topics().out('array');
    const organizations = doc.organizations().out('array');
    const places = doc.places().out('array');
    const people = doc.people().out('array');
    const acronyms = doc.acronyms().out('array');

    let combinedKeywords = [...keywords, ...topics, ...organizations, ...places, ...people, ...acronyms];

    const cleanTerm = (term: string): string => {
        if (typeof term !== 'string') return '';
        let cleaned = term.trim().toLowerCase();
        cleaned = cleaned.replace(/'s$/, ''); 
        cleaned = cleaned.replace(/^[.,!?;:]+|[.,!?;:]+$/g, '');
        return cleaned;
    };
    
    const stopWords = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'from', 'of', 'for', 'with', 
        'it', 'its', 'is', 'was', 'were', 'be', 'being', 'been', 'he', 'she', 'they', 'them', 'their', 
        'this', 'that', 'these', 'those', 'i', 'you', 'me', 'my', 'your', 'we', 'us', 'our', 
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could',
        'may', 'might', 'must', 'about', 'above', 'below', 'over', 'under', 'again', 'further', 'then', 
        'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 
        'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 're',
        'news', 'article', 'source', 'feed', 'rss', 'update', 'updates', 'story', 'report', 'reports', 
        'says', 'said', 'told', 'also', 'like', 'via', 'pm', 'am', 'gmt', 'est', 'edt', 'pst', 'pdt',
        'read', 'more', 'view', 'comments', 'share', 'follow', 'copyright', 'reserved', 'rights',
        'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 
        'october', 'november', 'december', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 
        'saturday', 'sunday', 'today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'time',
        'new', 'old', 'first', 'last', 'next', 'previous', 'world', 'politics', 'us', 'u.s', 'u.s.',
        'no.', 'inc.', 'ltd.', 'corp.', 'co.', 'llc', '-', '--', '...', '',
    ]);

    const processedKeywords = combinedKeywords
      .map(cleanTerm)
      .filter(term => term.length > 2 && !stopWords.has(term) && isNaN(Number(term)));
      
    const uniqueKeywords = Array.from(new Set(processedKeywords));
    const MAX_KEYWORDS = 15;
    const finalKeywords = uniqueKeywords.slice(0, MAX_KEYWORDS);

    return finalKeywords;

  } catch (error) {
    console.error(`Error extracting keywords for "${newsItem.title}":`, error);
    return [];
  }
};

// Simple bias analysis based on source name (placeholder)
const analyzeMediaBias = (sourceName: string): PoliticalBias => {
    const lowerSourceName = sourceName.toLowerCase();
    // Check against known feed configurations first
    const matchedFeed = DEFAULT_RSS_FEEDS.find(feed => feed.name.toLowerCase() === lowerSourceName);
    if (matchedFeed) {
      return matchedFeed.bias;
    }
    // Add more sophisticated bias analysis if needed
    return PoliticalBias.Unclear;
};

// --- Local Storage Persistence (Example - not used in backend server) ---

// Function to save a time snapshot to local storage
const saveTimeSnapshot = (snapshot: TimeSnapshot): void => {
  // In a backend, this would save to a database or file
  // localStorage.setItem(`snapshot_${snapshot.timestamp}`, JSON.stringify(snapshot));
  console.log(`Placeholder: Would save snapshot for ${snapshot.timestamp}`);
};

// Function to retrieve a time snapshot from local storage
const getTimeSnapshot = (timestamp: string): TimeSnapshot | null => {
  // In a backend, this would query a database or file
  // const snapshotJson = localStorage.getItem(`snapshot_${timestamp}`);
  // return snapshotJson ? JSON.parse(snapshotJson) : null;
  console.log(`Placeholder: Would retrieve snapshot for ${timestamp}`);
  return null;
};

// --- RSS Feed State Management (Example - not used in backend server) ---
interface RssFeedState {
  [url: string]: { enabled: boolean };
}

const RSS_STATE_KEY = 'rssFeedState';

// Get the current state of RSS feeds from local storage
const getRssFeedState = (): RssFeedState => {
  // const stateJson = localStorage.getItem(RSS_STATE_KEY);
  // return stateJson ? JSON.parse(stateJson) : {};
  console.log("Placeholder: Would get RSS feed state");
  return {};
};

// Update the enabled state of a specific RSS feed
const updateRssFeedState = (url: string, enabled: boolean): void => {
  // const currentState = getRssFeedState();
  // currentState[url] = { enabled };
  // localStorage.setItem(RSS_STATE_KEY, JSON.stringify(currentState));
  console.log(`Placeholder: Would update RSS state for ${url} to ${enabled}`);
};

// Initialize RSS state if it doesn't exist
const initializeRssState = () => {
  // const existingState = localStorage.getItem(RSS_STATE_KEY);
  // if (!existingState) {
  //   const initialState: RssFeedState = {};
  //   DEFAULT_RSS_FEEDS.forEach(feed => {
  //     initialState[feed.url] = { enabled: true }; // Default to enabled
  //   });
  //   localStorage.setItem(RSS_STATE_KEY, JSON.stringify(initialState));
  // }
  console.log("Placeholder: Would initialize RSS state");
};

// Call initialization on load (in a browser context)
// initializeRssState();

// Export relevant functions and constants
export {
  fetchNewsFromAPI,
  fetchAllNewsItems,
  mapArticleToNewsItem,
  extractKeywords,
  analyzeMediaBias,
  DEFAULT_RSS_FEEDS,
  // Add other exports if needed, e.g., type exports if not handled by index.ts
  // saveTimeSnapshot, 
  // getTimeSnapshot,
  // getRssFeedState,
  // updateRssFeedState
}; 