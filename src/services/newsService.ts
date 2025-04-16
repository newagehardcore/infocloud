import axios from 'axios';
import nlp from 'compromise';
import { NewsItem, PoliticalBias, NewsCategory, TimeSnapshot, RssFeedConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { parseRawRssXml } from '../utils/rssUtils';

// Get the API keys from environment variables
const NEWS_API_KEY = process.env.REACT_APP_NEWS_API_KEY;
const GNEWS_API_KEY = process.env.REACT_APP_GNEWS_API_KEY;
const THE_NEWS_API_KEY = process.env.REACT_APP_THE_NEWS_API_KEY;

// Default RSS feeds - uses imported RssFeedConfig
const DEFAULT_RSS_FEEDS: RssFeedConfig[] = [
  // Mainstream Democrat (Politics, World, US)
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', name: 'New York Times', category: NewsCategory.World, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', name: 'New York Times Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR News', category: NewsCategory.US, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://www.vox.com/rss/world-politics/index.xml', name: 'Vox World Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamDemocrat }, // Also World
  { url: 'https://www.vanityfair.com/news/politics/rss', name: 'Vanity Fair Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamDemocrat }, // Also Entertainment?
  { url: 'https://www.newyorker.com/feed/everything', name: 'The New Yorker', category: NewsCategory.All, bias: PoliticalBias.MainstreamDemocrat }, // Broad

  // Alternative Left (Politics, US)
  { url: 'https://www.motherjones.com/feed/', name: 'Mother Jones', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://fair.org/feed/', name: 'FAIR', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft }, // Media criticism
  { url: 'https://truthout.org/latest/feed', name: 'Truthout', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://www.alternet.org/feeds/feed.rss', name: 'AlterNet', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },
  { url: 'https://theintercept.com/feed/?rss', name: 'The Intercept', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft }, // Investigative
  { url: 'https://www.truthdig.com/feed/', name: 'Truthdig', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeLeft },

  // Centrist (World, US)
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC News World', category: NewsCategory.World, bias: PoliticalBias.Centrist },
  { url: 'https://www.pbs.org/newshour/feeds/rss/headlines', name: 'PBS NewsHour', category: NewsCategory.US, bias: PoliticalBias.Centrist },
  // Consider adding Reuters, AP if needed for Centrist

  // Mainstream Republican (Politics, World, US)
  { url: 'https://www.washingtontimes.com/rss/headlines/news/world/', name: 'Washington Times World', category: NewsCategory.World, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://www.washingtontimes.com/rss/headlines/news/politics/', name: 'Washington Times Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://moxie.foxnews.com/google-publisher/world.xml', name: 'Fox News World', category: NewsCategory.World, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://moxie.foxnews.com/google-publisher/politics.xml', name: 'Fox News Politics', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://moxie.foxnews.com/google-publisher/us.xml', name: 'Fox News US', category: NewsCategory.US, bias: PoliticalBias.MainstreamRepublican },
  { url: 'http://feeds.foxnews.com/foxnews/politics', name: 'Fox News Politics (Alt)', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },
  { url: 'https://nypost.com/feed/', name: 'New York Post', category: NewsCategory.All, bias: PoliticalBias.MainstreamRepublican }, // Broad, leans US/Crime
  { url: 'https://www.nationalreview.com/feed/', name: 'National Review', category: NewsCategory.Politics, bias: PoliticalBias.MainstreamRepublican },

  // Alternative Right (Politics)
  { url: 'https://www.breitbart.com/feed/', name: 'Breitbart News', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'http://feeds.feedburner.com/breitbart', name: 'Breitbart News (Alt)', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://www.dailywire.com/feeds/rss.xml', name: 'The Daily Wire', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://dailycaller.com/feed/', name: 'The Daily Caller', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://www.theamericanconservative.com/feed/', name: 'The American Conservative', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },
  { url: 'https://thepoliticalinsider.com/feed/', name: 'The Political Insider', category: NewsCategory.Politics, bias: PoliticalBias.AlternativeRight },

  // Business/Financial
  { url: 'https://www.economist.com/the-world-this-week/rss.xml', name: 'The Economist', category: NewsCategory.Finance, bias: PoliticalBias.Centrist }, // More World/Politics too
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', name: 'CNBC World', category: NewsCategory.Finance, bias: PoliticalBias.Centrist }, // More Finance

  // International Perspectives (Often World)
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera', category: NewsCategory.World, bias: PoliticalBias.MainstreamDemocrat }, // Often considered left-leaning internationally
  { url: 'https://feeds.theguardian.com/theguardian/world/rss', name: 'The Guardian World', category: NewsCategory.World, bias: PoliticalBias.MainstreamDemocrat },
  { url: 'https://rss.dw.com/rdf/rss-en-all', name: 'Deutsche Welle News', category: NewsCategory.World, bias: PoliticalBias.Centrist },
  { url: 'https://timesofindia.indiatimes.com/rssfeeds_us/-2128936835.cms', name: 'Times of India', category: NewsCategory.World, bias: PoliticalBias.Centrist }, // Indian perspective
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
    case 'world': return NewsCategory.World;
    case 'general': return NewsCategory.All;
    case 'finance': return NewsCategory.Finance;
    case 'education': return NewsCategory.Education;
    default: return null;
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
      
      console.log(`Fetching from TheNewsAPI top news endpoint: ${topNewsUrl.toString().replace(THE_NEWS_API_KEY, '[REDACTED]')}`);
      
      try {
        const topResponse = await axios.get(topNewsUrl.toString(), {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'InfoCloud/1.0'
          }
        });
        
        console.log(`TheNewsAPI top news response status: ${topResponse.status}`);
        
        if (topResponse.data.data && topResponse.data.data.length > 0) {
          console.log(`TheNewsAPI returned ${topResponse.data.data.length} top news articles`);
          articles = articles.concat(topResponse.data.data);
        } else {
          console.warn('No top articles found from TheNewsAPI, trying all news endpoint');
        }
      } catch (error) {
        console.warn('Error fetching top news from TheNewsAPI, trying all news endpoint:', error);
      }
      
      // If top news failed or returned few results, try 'all' endpoint as fallback
      if (articles.length < 5) { 
        console.log('Fetching from TheNewsAPI \'all\' endpoint as fallback...');
        // Try all news endpoint
        const allNewsUrl = new URL('https://api.thenewsapi.com/v1/news/all');
        allNewsUrl.searchParams.append('api_token', THE_NEWS_API_KEY);
        allNewsUrl.searchParams.append('language', 'en');
        allNewsUrl.searchParams.append('limit', '10');
        
        // Try without specifying domains to get more results
        // Add a more general search term 
        allNewsUrl.searchParams.append('search', 'current events');
        
        if (apiCategory) {
          allNewsUrl.searchParams.append('categories', apiCategory);
        }
        
        console.log(`Fetching from TheNewsAPI all news endpoint: ${allNewsUrl.toString().replace(THE_NEWS_API_KEY, '[REDACTED]')}`);
        
        try {
          const allResponse = await axios.get(allNewsUrl.toString(), {
            timeout: 10000,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'InfoCloud/1.0'
            }
          });
          
          console.log(`TheNewsAPI all news response status: ${allResponse.status}`);
          
          if (!allResponse.data.data || allResponse.data.data.length === 0) {
            console.warn('No articles found from TheNewsAPI all news endpoint, trying with domains');
            
            // Last attempt with specified domains
            const domainsUrl = new URL('https://api.thenewsapi.com/v1/news/all');
            domainsUrl.searchParams.append('api_token', THE_NEWS_API_KEY);
            domainsUrl.searchParams.append('language', 'en');
            domainsUrl.searchParams.append('limit', '10');
            domainsUrl.searchParams.append('domains', 'cnn.com,bbc.com,reuters.com');
            
            const domainsResponse = await axios.get(domainsUrl.toString(), {
              timeout: 10000,
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'InfoCloud/1.0'
              }
            });
            
            if (!domainsResponse.data.data || domainsResponse.data.data.length === 0) {
              console.warn('No articles found from TheNewsAPI with domains');
              onNewsReceived([]);
              return;
            }
            
            articles = articles.concat(domainsResponse.data.data);
          }
          
          console.log(`TheNewsAPI returned ${allResponse.data.data.length} all news articles`);
          articles = articles.concat(allResponse.data.data);
        } catch (error) {
          console.error('Error fetching all news from TheNewsAPI:', error);
          
          // Final attempt with simpler parameters
          try {
            const simpleUrl = new URL('https://api.thenewsapi.com/v1/news/all');
            simpleUrl.searchParams.append('api_token', THE_NEWS_API_KEY);
            simpleUrl.searchParams.append('limit', '5');
            
            const simpleResponse = await axios.get(simpleUrl.toString(), {
              timeout: 10000,
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'InfoCloud/1.0'
              }
            });
            
            if (simpleResponse.data.data && simpleResponse.data.data.length > 0) {
              articles = articles.concat(simpleResponse.data.data);
            }
          } catch (finalError) {
            console.error('Final attempt to fetch from TheNewsAPI failed:', finalError);
          }
          
          onNewsReceived([]);
          return;
        }
      }
      
      // Deduplicate articles based on URL before processing
      const uniqueArticles = Array.from(new Map(articles.map(a => [a.url, a])).values());
      console.log(`Processing ${uniqueArticles.length} unique articles from TheNewsAPI.`);

      if (uniqueArticles.length === 0) {
        onNewsReceived([]);
        return;
      }
      
      // Process articles, passing requestedCategory
      processedItems = await this.processArticles(uniqueArticles, requestedCategory);

    } catch (error) {
      console.error('Error fetching news from TheNewsAPI:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error(`TheNewsAPI error status: ${error.response.status}`);
          console.error('TheNewsAPI error data:', error.response.data);
        } else if (error.request) {
          console.error('TheNewsAPI error - no response received:', error.request);
        } else {
          console.error('TheNewsAPI error setting up request:', error.message);
        }
      }
      processedItems = [];
    } finally {
      onNewsReceived(processedItems);
    }
  }

  private async processArticles(articles: any[], requestedCategory: NewsCategory): Promise<NewsItem[]> {
    const mappedItems: (NewsItem | null)[] = await Promise.all(
      articles.map(async (article: any, index: number) => {
        const newsItem = mapArticleToNewsItem(article, index, 'TheNewsAPI', undefined, requestedCategory);
        // Keywords only if mapping is successful
        if (newsItem) {
            // Add rudimentary keyword extraction if needed, or rely on API keywords if provided
            // Example: if (!newsItem.keywords || newsItem.keywords.length === 0) {
            //    newsItem.keywords = await extractKeywords(newsItem);
            // }
            // Currently, mapArticleToNewsItem initializes keywords as []
             newsItem.keywords = await extractKeywords(newsItem); // Keep extracting for now
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

// RSS Source implementation
class RSSSource implements NewsSource {
  async fetchNews(requestedCategory: NewsCategory = NewsCategory.All, onNewsReceived: (newsItems: NewsItem[]) => void): Promise<void> {
    const state = getRssFeedState();
    const activeFeeds = DEFAULT_RSS_FEEDS.filter(feed => 
      state[feed.url]?.enabled !== false &&
      (requestedCategory === NewsCategory.All || feed.category === requestedCategory || feed.category === NewsCategory.All)
    );
    console.log(`[RSS] Fetching ${activeFeeds.length} feeds for category: ${requestedCategory}`);

    // Process feeds individually
    const feedPromises = activeFeeds.map(async (feedConfig) => {
      let validItems: NewsItem[] = [];
      try {
        console.log(`[RSS] Backend proxy fetching RSS feed: ${feedConfig.url}`);
        // Use the backend proxy endpoint
        const response = await axios.get(`/api/rss-feed?url=${encodeURIComponent(feedConfig.url)}`, { timeout: 15000 });
        const feedData = response.data; // Assuming proxy returns parsed JSON matching rss-parser structure

        // Handle both parsed feed and raw XML content
        let feedItems = [];
        if (feedData.success) {
          if (feedData.rawContent) {
            // Parse the raw XML content
            const parsedFeed = await parseRawRssXml(feedData.feed.rawXml);
            feedItems = parsedFeed.items || [];
          } else {
            // Use the pre-parsed feed data
            feedItems = feedData.feed.items || [];
          }
        }

        if (!feedItems || feedItems.length === 0) {
          console.warn(`[RSS] No items found or failed to parse feed: ${feedConfig.name} (${feedConfig.url})`);
          return [];
        }

        // Process items, passing requestedCategory
        const mappedItems: (NewsItem | null)[] = await Promise.all(
          feedItems.map(async (item: any, index: number) => {
            const rssItem = {
              title: item.title || 'No Title',
              description: item.contentSnippet || item.content || item.summary || 'No description',
              url: item.link || '',
              source: { name: feedConfig.name, id: feedConfig.url }, // Use config name/URL
              publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
              section: feedConfig.category, // Use category from config
              author: item.creator || item.author || ''
            };
            // Pass requestedCategory (though RSS uses feedConfig directly)
            const newsItem = mapArticleToNewsItem(rssItem, index, 'RSS', feedConfig, requestedCategory); 
            if (newsItem) { 
              newsItem.keywords = await extractKeywords(newsItem); 
            }
            return newsItem;
          })
        );
        
        // Filter out nulls
        validItems = mappedItems.filter((item): item is NewsItem => item !== null);
      } catch (error: any) {
        let errorMessage = `Error fetching or parsing RSS feed: ${feedConfig.name}`;
        if (axios.isAxiosError(error)) {
          errorMessage += ` (Status: ${error.response?.status}, URL: ${feedConfig.url})`;
          if (error.code === 'ECONNABORTED') {
            errorMessage += ' - Timeout';
          }
        } else if (error instanceof Error) {
          errorMessage += `: ${error.message}`;
        }
        console.error(errorMessage);
        validItems = [];
      } finally {
        onNewsReceived(validItems);
      }
    });

    // Wait for all individual feed processing to settle
    await Promise.allSettled(feedPromises);
    console.log(`[RSS] Finished processing all requested feeds for category ${requestedCategory}.`);
  }

  getSourceName(): string {
    return 'RSS';
  }
}

// Initialize the news sources
const newsSources: NewsSource[] = [
  new NewsAPISource(),
  new GNewsAPISource(),
  new TheNewsAPISource(),
  new RSSSource()
];

// Helper function to check if an API is enabled in localStorage
const isApiEnabled = (apiName: string, defaultValue: boolean = true): boolean => {
  const storedValue = localStorage.getItem(`api_${apiName.replace(/\s+/g, '')}_enabled`);
  return storedValue === null ? defaultValue : storedValue === 'true';
};

// Streaming fetch function
const fetchNewsFromAPI = async (
  requestedCategory: NewsCategory = NewsCategory.All,
  onNewsReceived: (newsItems: NewsItem[]) => void
): Promise<void> => {
  try {
    const hasApiKeys = NEWS_API_KEY || GNEWS_API_KEY || THE_NEWS_API_KEY;
    const isRssEnabled = isApiEnabled('RSS');
    if (!hasApiKeys && !isRssEnabled) {
      console.warn('No API keys or enabled RSS. No sources to fetch.');
      onNewsReceived([]); 
      return;
    }

    const sourcesToFetch = newsSources.filter(source => {
      if (source instanceof NewsAPISource) return NEWS_API_KEY && isApiEnabled('NewsAPI');
      if (source instanceof GNewsAPISource) return GNEWS_API_KEY && isApiEnabled('GNews');
      if (source instanceof TheNewsAPISource) return THE_NEWS_API_KEY && isApiEnabled('TheNewsAPI');
      if (source instanceof RSSSource) return isApiEnabled('RSS');
      return false;
    });

    if (sourcesToFetch.length === 0) {
      console.warn('No sources enabled or keyed.');
      onNewsReceived([]);
      return;
    }

    // Array to hold promises, each resolving to an array of NewsItems from a source
    const allFetchPromises: Promise<NewsItem[]>[] = sourcesToFetch.map(source => {
      return new Promise<NewsItem[]>(async (resolve) => {
        try {
          // Store all items from this source
          const itemsFromSource: NewsItem[] = [];
          
          // Internal callback that collects items but doesn't forward to main callback
          const sourceCallback = (batchItems: NewsItem[]) => {
            if (Array.isArray(batchItems) && batchItems.length > 0) {
              itemsFromSource.push(...batchItems);
            }
          };
          
          // Call the source's fetchNews with the internal collector callback
          await source.fetchNews(requestedCategory, sourceCallback);
          
          // Update working status for debug panel
          const isWorking = itemsFromSource.length > 0;
          localStorage.setItem(`api_${source.getSourceName().replace(/\s+/g, '')}_working`, 
                              isWorking ? 'true' : 'false');
          
          // Resolve with all items from this source
          resolve(itemsFromSource);
        } catch (error) {
          console.error(`Error fetching from source ${source.getSourceName()}:`, error);
          resolve([]); // Resolve with empty array on error
        }
      });
    });

    console.log(`Initiated fetches from ${allFetchPromises.length} sources for category: ${requestedCategory}`);
    
    // Wait for all source fetches to settle
    const results = await Promise.allSettled(allFetchPromises);
    console.log("All news fetching operations have completed.");

    // Combine results from all sources
    const allItems: NewsItem[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        const sourceName = sourcesToFetch[index]?.getSourceName() || 'unknown';
        console.log(`Source ${sourceName} returned ${result.value.length} items`);
        allItems.push(...result.value);
      }
    });

    // Deduplicate items
    const seenKeys = new Set<string>();
    const uniqueItems = allItems.filter(item => {
      const key = item.url || item.title;
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        return true;
      }
      return false;
    });

    console.log(`Total unique items after deduplication: ${uniqueItems.length}`);
    
    // Call the main callback once with all combined and deduplicated items
    onNewsReceived(uniqueItems);
    
  } catch (error) {
    console.error('Error in fetchNewsFromAPI:', error);
    onNewsReceived([]); // Signal completion/failure with empty array
  }
};

// NEW function: Blocking fetch to get all items at once
const fetchAllNewsItems = async (
  requestedCategory: NewsCategory = NewsCategory.All
): Promise<NewsItem[]> => {
  return new Promise<NewsItem[]>((resolve, reject) => {
    let combinedItems: NewsItem[] = [];
    const seenUrls = new Set<string>();

    // Collector callback
    const handleBatchReceived = (newsItemsBatch: NewsItem[]) => {
      if (newsItemsBatch && newsItemsBatch.length > 0) {
        const uniqueNewItems = newsItemsBatch.filter(item => {
          const key = item.url || item.title;
          if (key && !seenUrls.has(key)) { 
            seenUrls.add(key);
            return true;
          }
          return false;
        });
        combinedItems = combinedItems.concat(uniqueNewItems);
      }
    };

    // Call the streaming function
    fetchNewsFromAPI(requestedCategory, handleBatchReceived)
      .then(() => {
        // Resolve with combined list after streaming finishes
        console.log(`fetchAllNewsItems collected ${combinedItems.length} unique items.`);
        resolve(combinedItems);
      })
      .catch(error => {
        // Reject if the streaming orchestration failed
        console.error('Error occurred within fetchAllNewsItems execution:', error);
        reject(error); 
      });
  });
};

// Helper function to map our category to NewsAPI category
const mapCategoryToNewsAPI = (category: NewsCategory): string | null => {
  switch (category) {
    case NewsCategory.Entertainment: return 'entertainment';
    case NewsCategory.Health: return 'health';
    case NewsCategory.Science: return 'science';
    case NewsCategory.Sports: return 'sports';
    case NewsCategory.Tech: return 'technology';
    case NewsCategory.US: return 'politics';
    case NewsCategory.World: return 'world';
    case NewsCategory.All: return 'general';
    case NewsCategory.Finance: return 'business'; // Map Finance to business
    default: return null;
  }
};

// Helper function to map our category to GNews topics
const mapCategoryToGNews = (category: NewsCategory): string | null => {
  switch (category) {
    case NewsCategory.Entertainment: return 'entertainment';
    case NewsCategory.Health: return 'health';
    case NewsCategory.Science: return 'science';
    case NewsCategory.Sports: return 'sports';
    case NewsCategory.Tech: return 'technology';
    case NewsCategory.World: return 'world';
    case NewsCategory.US: return 'nation';
    case NewsCategory.All: return null;
    case NewsCategory.Finance: return 'business'; // Map Finance to business
    default: return null;
  }
};

// Helper function to map our category to TheNewsAPI category
const mapCategoryToTheNewsAPI = (category: NewsCategory): string | null => {
  switch (category) {
    case NewsCategory.Entertainment: return 'entertainment';
    case NewsCategory.Health: return 'health';
    case NewsCategory.Science: return 'science';
    case NewsCategory.Sports: return 'sports';
    case NewsCategory.Tech: return 'tech';  // TheNewsAPI uses 'tech' instead of 'technology'
    case NewsCategory.US: return 'politics';
    case NewsCategory.World: return 'world';
    case NewsCategory.All: return 'general';
    case NewsCategory.Finance: return 'business'; // Map Finance to business
    default: return null;
  }
};

// Helper function to map article data to our NewsItem format
// Added feedConfig and requestedCategory parameters
const mapArticleToNewsItem = (
  article: any, 
  index: number, 
  apiSource: string, 
  feedConfig?: RssFeedConfig,
  requestedCategory?: NewsCategory // Added parameter
): NewsItem | null => {
  try {
    let category: NewsCategory;
    let bias: PoliticalBias;
    let sourceName = '';
    let sourceId = '';

    if (apiSource === 'RSS' && feedConfig) {
      sourceName = feedConfig.name;
      sourceId = feedConfig.url;
      bias = feedConfig.bias; 
      category = feedConfig.category; // 1. Use category from RSS config first
    } else if (apiSource === 'TheNewsAPI') {
      sourceName = article.source || 'TheNewsAPI';
      sourceId = article.uuid || 'thenewsapi';
      bias = analyzeMediaBias(sourceName); 
      // 2. Try mapping API's category
      const apiCategories = article.categories || [];
      const mappedCategory = apiCategories.length > 0 ? mapTheNewsAPIToCategory(apiCategories[0]) : null;
      // 3. Use mapped API category, or fallback to the originally requested category
      category = mappedCategory || requestedCategory || NewsCategory.All; 
    } else if (apiSource === 'NewsAPI' || apiSource === 'GNews') {
      // These APIs might not provide reliable per-article categories easily mapped
      sourceName = article.source?.name || apiSource;
      sourceId = article.source?.id || apiSource.toLowerCase();
      bias = analyzeMediaBias(sourceName);
      // 4. Directly use the originally requested category for these APIs
      category = requestedCategory || NewsCategory.All; 
    } else {
      // Fallback / Unknown source
      sourceName = article.source?.name || 'Unknown Source';
      sourceId = 'unknown';
      bias = analyzeMediaBias(sourceName);
      // 5. Use requested category if available, else default to All
      category = requestedCategory || NewsCategory.All; 
    }
    
    // Sanitize description (basic example)
    let description = article.description || article.content || '';
    if (description && description.length > 500) { // Limit description length
        description = description.substring(0, 497) + '...';
    }
    // Remove potential HTML tags (very basic)
    description = description.replace(/<[^>]*>?/gm, '');


    // Ensure required fields have defaults
    const title = article.title || 'Untitled';
    const url = article.url || '';
    // Enhanced date parsing with multiple format support
    let publishedAt = new Date();
    
    try {
      // Try to get the date from various possible fields
      const dateStr = article.publishedAt || article.pubDate || article.date;
      
      if (dateStr) {
        // First try direct parsing
        let parsedDate = new Date(dateStr);
        
        // If invalid, try cleaning up the string
        if (isNaN(parsedDate.getTime())) {
          // Replace timezone abbreviations with offsets
          let cleanDateStr = dateStr
            .replace(' PT', '-0700')  // Pacific Time
            .replace(' ET', '-0400')  // Eastern Time
            .replace(' GMT', '+0000') // GMT
            .replace(' IST', '+0530'); // Indian Standard Time
            
          parsedDate = new Date(cleanDateStr);
          
          // If still invalid, try parsing without timezone
          if (isNaN(parsedDate.getTime())) {
            cleanDateStr = dateStr.replace(/\s[A-Z]{2,3}$/, '');
            parsedDate = new Date(cleanDateStr);
          }
        }
        
        // Use parsed date if valid, otherwise keep current time
        if (!isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate;
        } else {
          console.warn(`Could not parse date: "${dateStr}" for article: "${article.title}"`);
        }
      }
    } catch (error) {
      console.warn(`Error parsing date for article: "${article.title}"`, error);
    }
    const id = `${apiSource}-${sourceId}-${uuidv4()}`; // Generate unique ID

    // Ensure the assigned category is valid, default to All if not
    if (!Object.values(NewsCategory).includes(category)) {
        console.warn(`Invalid category determined/assigned for article: ${title}, defaulting to All.`);
        category = NewsCategory.All;
    }


    return {
      id: id,
      title: title,
      description: description,
      url: url,
      source: { name: sourceName, bias: bias },
      publishedAt: publishedAt.toISOString(),
      category: category, // Use the determined/assigned category
      keywords: [], // Keywords will be added later
    };
  } catch (error) {
    console.error(`Error mapping article from ${apiSource}:`, article, error);
    return null;
  }
};

// Common English stop words to filter out
const stopWords = [
  'about', 'after', 'again', 'all', 'also', 'and', 'any', 'are', 'because',
  'been', 'before', 'being', 'between', 'both', 'but', 'came', 'can',
  'come', 'could', 'did', 'does', 'doing', 'during', 'each', 'even',
  'from', 'further', 'had', 'has', 'have', 'having', 'here', 'how',
  'into', 'just', 'like', 'more', 'most', 'much', 'now', 'only', 'other',
  'our', 'over', 'said', 'same', 'should', 'some', 'such', 'than', 'that',
  'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'too', 'under', 'until', 'very', 'was', 'way', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'with', 'would', 'you', 'your',
  
  // Section titles and category words
  'world', 'us', 'politics', 'tech', 'finance', 
  'entertainment', 'sports', 'health', 'science', 'education',
  'all',
  
  // Time-related words
  'today', 'yesterday', 'tomorrow', 'week', 'month', 'year', 'day', 'hour', 'minute',
  'morning', 'afternoon', 'evening', 'night', 'monday', 'tuesday', 'wednesday', 
  'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april',
  'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  
  // Descriptive verbs that don't add much meaning
  'says', 'said', 'told', 'announced', 'reported', 'claimed', 'stated', 'described',
  'appeared', 'revealed', 'suggested', 'mentioned', 'noted', 'added', 'explained',
  'confirmed', 'denied', 'asked', 'called', 'commented', 'shared', 'showed',
  
  // Common news article terms
  'report', 'story', 'article', 'headline', 'breaking', 'update', 'news', 'latest',
  'exclusive', 'interview', 'statement', 'press', 'release', 'analysis', 'opinion',
  'editorial', 'feature', 'briefing', 'recap', 'roundup', 'summary', 'preview',
  'review', 'guide', 'explainer', 'breakdown', 'profile', 'description', 'cartoon',
  
  // General filler words
  'amid', 'despite', 'following', 'according', 'regarding', 'concerning',
  'per', 'via', 'through', 'throughout', 'during', 'before', 'after',
  'among', 'between', 'within', 'around', 'across', 'along', 'beyond',
  
  // Common adjectives in news
  'new', 'top', 'big', 'major', 'key', 'important', 'significant', 'critical',
  'essential', 'vital', 'crucial', 'main', 'primary', 'secondary', 'notable',
  'recent', 'latest', 'current', 'ongoing', 'developing', 'upcoming', 'potential',
  'possible', 'likely', 'unlikely', 'certain', 'controversial', 'popular',
  
  // Additional common words
  'first', 'second', 'third', 'last', 'next', 'previous', 'final',
  'begin', 'began', 'begun', 'start', 'started', 'end', 'ended',
  'show', 'shows', 'showing', 'shown', 'see', 'sees', 'seen', 'saw',
  'watch', 'watched', 'watching', 'look', 'looked', 'looking',
  'think', 'thought', 'thinking', 'make', 'made', 'making',
  'take', 'took', 'taken', 'taking', 'get', 'got', 'getting',
  'find', 'found', 'finding', 'use', 'used', 'using',
  'tell', 'telling', 'become', 'became', 'becoming',
  
  // Form/media type words
  'video', 'audio', 'podcast', 'image', 'photo', 'picture', 'clip',
  'series', 'episode', 'season', 'show', 'film', 'documentary'
];

// List of media source names to filter out from keywords
const mediaSourceNames = [
  // Mainstream Democrat
  'cnn', 'msnbc', 'new york times', 'the new york times', 'washington post',
  'npr', 'abc news', 'cbs news', 'nbc news', 'time', 
  
  // Alternative Left
  'mother jones', 'democracy now', 'huffington post', 'vox',
  'vanity fair', 'the new yorker', 'fair', 'truthout', 'alternet', 
  'the intercept', 'truthdig', 'raw story',
  
  // Centrist
  'associated press', 'reuters', 'bbc', 'christian science monitor',
  'axios', 'bloomberg', 'usa today', 'the hill', 'pbs',
  
  // Mainstream Republican
  'wall street journal', 'washington times', 'national review', 'fox news',
  'new york post', 'forbes',
  
  // Alternative Right
  'the daily wire', 'the american conservative', 'breitbart', 'the daily caller',
  'the political insider', 'newsmax',
  
  // Mixed/Financial
  'the economist', 'financial times', 'cnbc',
  
  // International
  'al jazeera', 'the guardian', 'deutsche welle', 'france 24', 'times of india',
  
  // Shortened forms that might appear
  'breitbart', 'fox', 'dailywire', 'dailycaller', 'nytimes', 'wapo'
];

// Extract keywords from a news item
const extractKeywords = async (newsItem: NewsItem): Promise<string[]> => {
  // Helper function to decode HTML entities
  const decodeHtml = (html: string): string => {
    return html
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&') 
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&ldquo;|&rdquo;/g, '"');
  };
  
  // Combine title and description for better keyword extraction
  // Decode HTML entities first
  const text = `${decodeHtml(newsItem.title)} ${decodeHtml(newsItem.description)}`;
  
  try {
    // Use compromise NLP to extract various types of terms
    const doc = nlp(text);
    
    // Get topics (main subjects)
    const topics = doc.topics().json({ normal: true });
    
    // Get all nouns (including proper nouns)
    const nouns = doc.nouns().json({ normal: true });
    
    // Get organizations and company names
    const organizations = doc.organizations().json({ normal: true });
    
    // Get people (named entities)
    const people = doc.people().json({ normal: true });
    
    // Get places and locations
    const places = doc.places().json({ normal: true });
    
    // Get verbs (actions) - only infinitive forms to reduce common verb forms
    const verbs = doc.verbs().if('#Infinitive').json({ normal: true });
    
    // Try to extract noun phrases for multi-word entities
    const nounPhrases = doc.match('#Adjective? #Noun+').json({ normal: true });
    
    // Extract specific person names with titles
    const personTitles = doc.match('(president|senator|vice president|governor|secretary|prime minister|chancellor) #Person+').json({ normal: true });
    
    // Combine all terms and remove duplicates
    const allTerms = [
      ...topics,
      ...nouns,
      ...organizations,
      ...people,
      ...places,
      ...verbs,
      ...nounPhrases,
      ...personTitles
    ].map(term => term.normal || term.text);
    
    const uniqueTerms = Array.from(new Set(allTerms));
    
    // Clean HTML entities and normalize punctuation
    const cleanTerm = (term: string): string => {
      // Convert HTML entities to their character equivalents 
      const decodedStr = term.replace(/&apos;/g, "'")
                              .replace(/&quot;/g, '"')
                              .replace(/&amp;/g, '&')
                              .replace(/&lt;/g, '<')
                              .replace(/&gt;/g, '>')
                              .replace(/&#39;/g, "'") 
                              .replace(/&rsquo;/g, "'")
                              .replace(/&ldquo;|&rdquo;/g, '"');
      
      // Normalize apostrophes (replace fancy quotes with standard apostrophe)
      const normalizedApostrophes = decodedStr.replace(/['′'']/g, "'");
      
      // Remove all punctuation except apostrophes in words (like "don't")
      return normalizedApostrophes.replace(/[.,;:!?()[\]{}"\/\\|@#$%^&*+=_~<>]/g, '')
                                 .replace(/\s-+\s/g, ' '); // Remove standalone hyphens
    };
    
    // Filter out stop words, short terms, numbers, and source names
    const filteredTerms = uniqueTerms.filter(term => {
      // First clean the term
      const cleanedTerm = cleanTerm(term);
      const lowerTerm = cleanedTerm.toLowerCase();
      
      // Block all terms containing "cartoon" in any form
      if (lowerTerm.includes('cartoon')) {
        return false;
      }
      
      // Skip terms that are only numbers or very short
      if (cleanedTerm.length <= 2 || /^\d+$/.test(cleanedTerm)) {
        return false;
      }
      
      // Skip terms that are in our stopwords list
      if (stopWords.includes(lowerTerm)) {
        return false;
      }
      
      // Skip terms that include media source names
      if (mediaSourceNames.some(source => lowerTerm === source || lowerTerm.includes(source))) {
        return false;
      }
      
      // Additional filtering for terms that are just single common words
      if (cleanedTerm.length <= 4 && /^[a-z]+$/.test(lowerTerm)) {
        return false;
      }
      
      return true;
    }).map(term => cleanTerm(term)); // Return the cleaned term
    
    // Normalize entities to combine variations (e.g., Trump, Donald Trump, President Trump)
    // The actual normalization will happen in wordProcessing.ts
    
    // Return more keywords (up to 30 per article)
    return filteredTerms.slice(0, 30);
  } catch (error) {
    console.error('Error extracting keywords:', error);
    // Return some basic keywords from the title as fallback
    return newsItem.title
      .toLowerCase()
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !stopWords.includes(word) && 
        !word.includes('cartoon') &&
        !mediaSourceNames.some(source => word === source || word.includes(source))
      )
      .slice(0, 10);
  }
};

// Analyze political bias of a media source
const analyzeMediaBias = (sourceName: string): PoliticalBias => {
  // This is a simplified mapping of news sources to political bias
  const sourceMapping: Record<string, PoliticalBias> = {
    // Mainstream Democrat
    'CNN': PoliticalBias.MainstreamDemocrat,
    'MSNBC': PoliticalBias.MainstreamDemocrat,
    'New York Times': PoliticalBias.MainstreamDemocrat,
    'The New York Times': PoliticalBias.MainstreamDemocrat,
    'Washington Post': PoliticalBias.MainstreamDemocrat,
    'NPR': PoliticalBias.MainstreamDemocrat,
    'ABC News': PoliticalBias.MainstreamDemocrat,
    'CBS News': PoliticalBias.MainstreamDemocrat,
    'NBC News': PoliticalBias.MainstreamDemocrat,
    'Time': PoliticalBias.MainstreamDemocrat,
    
    // Alternative Left
    'Mother Jones': PoliticalBias.AlternativeLeft,
    'Democracy Now': PoliticalBias.AlternativeLeft,
    'Huffington Post': PoliticalBias.AlternativeLeft,
    'Vox': PoliticalBias.AlternativeLeft,
    
    // Centrist
    'Associated Press': PoliticalBias.Centrist,
    'Reuters': PoliticalBias.Centrist,
    'BBC': PoliticalBias.Centrist,
    'Christian Science Monitor': PoliticalBias.Centrist,
    'Axios': PoliticalBias.Centrist,
    'Bloomberg': PoliticalBias.Centrist,
    'USA Today': PoliticalBias.Centrist,
    'The Hill': PoliticalBias.Centrist,
    
    // Mainstream Republican
    'Wall Street Journal': PoliticalBias.MainstreamRepublican,
    'Washington Times': PoliticalBias.MainstreamRepublican,
    'National Review': PoliticalBias.MainstreamRepublican,
    'Fox News': PoliticalBias.MainstreamRepublican,
    'New York Post': PoliticalBias.MainstreamRepublican,
    'Forbes': PoliticalBias.MainstreamRepublican,
    
    // Alternative Right
    'The Daily Wire': PoliticalBias.AlternativeRight,
    'The American Conservative': PoliticalBias.AlternativeRight,
    'Breitbart': PoliticalBias.AlternativeRight,
    'The Daily Caller': PoliticalBias.AlternativeRight,
    
    // Mixed/Financial
    'The Economist': PoliticalBias.Centrist,
    'Financial Times': PoliticalBias.Centrist,
    
    // International
    'Al Jazeera': PoliticalBias.Centrist,
    'The Guardian': PoliticalBias.MainstreamDemocrat,
    'Deutsche Welle': PoliticalBias.Centrist,
    'France 24': PoliticalBias.Centrist
  };
  
  // Look for exact match
  if (sourceName in sourceMapping) {
    return sourceMapping[sourceName];
  }
  
  // Look for partial match
  for (const source in sourceMapping) {
    if (sourceName.includes(source) || source.includes(sourceName)) {
      return sourceMapping[source];
    }
  }
  
  // Default to unclear if no match found
  return PoliticalBias.Unclear;
};

const saveTimeSnapshot = (snapshot: TimeSnapshot): void => {
  console.log('Saving time snapshot:', snapshot);
  // Implementation will depend on storage mechanism (localStorage, IndexedDB, server API, etc.)
};

const getTimeSnapshot = (timestamp: string): TimeSnapshot | null => {
  console.log('Getting time snapshot for:', timestamp);
  // Implementation will depend on storage mechanism
  return null;
};

// Function to get and set RSS feed enabled state (simple example using localStorage)
interface RssFeedState {
  [url: string]: { enabled: boolean };
}

const RSS_STATE_KEY = 'rssFeedState';

// Removed export keyword
const getRssFeedState = (): RssFeedState => {
  try {
    const storedState = localStorage.getItem(RSS_STATE_KEY);
    return storedState ? JSON.parse(storedState) : {};
  } catch (e) {
    console.error("Failed to parse RSS state from localStorage", e);
    return {};
  }
};

// Removed export keyword
const updateRssFeedState = (url: string, enabled: boolean): void => {
  const currentState = getRssFeedState();
  currentState[url] = { enabled };
  try {
    localStorage.setItem(RSS_STATE_KEY, JSON.stringify(currentState));
  } catch (e) {
    console.error("Failed to save RSS state to localStorage", e);
  }
};

// Initialize state for any default feeds not already in storage
const initializeRssState = () => {
  const currentState = getRssFeedState();
  let updated = false;
  DEFAULT_RSS_FEEDS.forEach(feed => {
    if (!(feed.url in currentState)) {
      currentState[feed.url] = { enabled: true }; // Default to enabled
      updated = true;
    }
  });
  if (updated) {
    try {
      localStorage.setItem(RSS_STATE_KEY, JSON.stringify(currentState));
    } catch (e) {
      console.error("Failed to initialize RSS state in localStorage", e);
    }
  }
};

// Call initialization on service load
initializeRssState();

// UPDATED EXPORTS - Keep this block as is
export {
  fetchNewsFromAPI, // Streaming version
  fetchAllNewsItems, // Blocking version
  extractKeywords,
  analyzeMediaBias,
  saveTimeSnapshot, 
  getTimeSnapshot,
  getRssFeedState, 
  updateRssFeedState,
  DEFAULT_RSS_FEEDS 
};
