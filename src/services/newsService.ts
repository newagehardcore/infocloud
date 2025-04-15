import axios from 'axios';
import nlp from 'compromise';
import { parse as parseRSS } from 'rss-to-json';
import Parser from 'rss-parser';
import { NewsItem, PoliticalBias, NewsCategory, TimeSnapshot } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { parseRawRssXml } from '../utils/rssUtils';

// Initialize RSS parser as fallback
const parser = new Parser();

// Get the API keys from environment variables
const NEWS_API_KEY = process.env.REACT_APP_NEWS_API_KEY;
const GNEWS_API_KEY = process.env.REACT_APP_GNEWS_API_KEY;
const THE_NEWS_API_KEY = process.env.REACT_APP_THE_NEWS_API_KEY;

// Default RSS feeds - can be expanded or made configurable
export const DEFAULT_RSS_FEEDS = [
  // Mainstream Left
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', name: 'New York Times' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', name: 'New York Times Politics' },
  { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR News' },
  { url: 'https://www.vox.com/rss/world-politics/index.xml', name: 'Vox World Politics' },
  { url: 'https://www.vanityfair.com/news/politics/rss', name: 'Vanity Fair Politics' },
  { url: 'https://www.newyorker.com/feed/everything', name: 'The New Yorker' },
  
  // Alternative Left
  { url: 'https://www.motherjones.com/feed/', name: 'Mother Jones' },
  { url: 'https://www.thenation.com/feed/', name: 'The Nation' },
  { url: 'https://fair.org/feed/', name: 'FAIR' },
  { url: 'https://truthout.org/latest/feed', name: 'Truthout' },
  { url: 'https://www.alternet.org/feeds/feed.rss', name: 'AlterNet' },
  { url: 'https://theintercept.com/feed/?rss', name: 'The Intercept' },
  { url: 'https://www.truthdig.com/feed/', name: 'Truthdig' },
  
  // Centrist
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC News World' },
  { url: 'https://www.pbs.org/newshour/feeds/rss/headlines', name: 'PBS NewsHour' },
  
  // Mainstream Right
  { url: 'https://www.washingtontimes.com/rss/headlines/news/world/', name: 'Washington Times World' },
  { url: 'https://www.washingtontimes.com/rss/headlines/news/politics/', name: 'Washington Times Politics' },
  { url: 'https://moxie.foxnews.com/google-publisher/world.xml', name: 'Fox News World' },
  { url: 'https://moxie.foxnews.com/google-publisher/politics.xml', name: 'Fox News Politics' },
  { url: 'https://moxie.foxnews.com/google-publisher/us.xml', name: 'Fox News US' },
  { url: 'http://feeds.foxnews.com/foxnews/politics', name: 'Fox News Politics (Alt)' },
  { url: 'https://nypost.com/feed/', name: 'New York Post' },
  { url: 'https://www.nationalreview.com/feed/', name: 'National Review' },
  
  // Alternative Right
  { url: 'https://www.breitbart.com/feed/', name: 'Breitbart News' },
  { url: 'http://feeds.feedburner.com/breitbart', name: 'Breitbart News (Alt)' },
  { url: 'https://www.dailywire.com/feeds/rss.xml', name: 'The Daily Wire' },
  { url: 'https://dailycaller.com/feed/', name: 'The Daily Caller' },
  { url: 'https://www.theamericanconservative.com/feed/', name: 'The American Conservative' },
  { url: 'https://thepoliticalinsider.com/feed/', name: 'The Political Insider' },
  { url: 'https://www.unz.com/xfeed/rss/all/', name: 'The Unz Review' },
  
  // Business/Financial
  { url: 'https://www.economist.com/the-world-this-week/rss.xml', name: 'The Economist' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', name: 'CNBC World' },
  
  // International Perspectives
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera' },
  { url: 'https://feeds.theguardian.com/theguardian/world/rss', name: 'The Guardian World' },
  { url: 'https://rss.dw.com/rdf/rss-en-all', name: 'Deutsche Welle News' },
  { url: 'https://timesofindia.indiatimes.com/rssfeeds_us/-2128936835.cms', name: 'Times of India' }
];

// News Source interface - any news API we add should implement this
interface NewsSource {
  fetchNews(category: NewsCategory): Promise<NewsItem[]>;
  getSourceName(): string;
}

// Helper function to map TheNewsAPI category to our internal NewsCategory
const mapTheNewsAPIToCategory = (apiCategory: string): NewsCategory | null => {
  const lowerCategory = apiCategory.toLowerCase();
  
  switch (lowerCategory) {
    case 'business': return NewsCategory.Business;
    case 'entertainment': return NewsCategory.Entertainment;
    case 'health': return NewsCategory.Health;
    case 'science': return NewsCategory.Science;
    case 'sports': return NewsCategory.Sports;
    case 'technology': return NewsCategory.Tech;
    case 'ai': return NewsCategory.AI;
    case 'art': return NewsCategory.Art;
    case 'space': return NewsCategory.Space;
    case 'politics': return NewsCategory.Politics;
    case 'world': return NewsCategory.World;
    case 'general': return NewsCategory.All;
    case 'finance': return NewsCategory.Finance;
    case 'education': return NewsCategory.Education;
    case 'environment': return NewsCategory.Environment;
    case 'military': return NewsCategory.Military;
    case 'crime': return NewsCategory.Crime;
    default: return null;
  }
};

// NewsAPI implementation
class NewsAPISource implements NewsSource {
  async fetchNews(category: NewsCategory = NewsCategory.All): Promise<NewsItem[]> {
    try {
      if (!NEWS_API_KEY) {
        console.warn('No NewsAPI key found.');
        return [];
      }

      // Map our category to NewsAPI category
      const apiCategory = mapCategoryToNewsAPI(category);
      
      // Fetch real data from NewsAPI
      const response = await axios.get(
        `https://newsapi.org/v2/top-headlines?country=us${apiCategory ? `&category=${apiCategory}` : ''}`,
        { headers: { 'X-Api-Key': NEWS_API_KEY } }
      );

      if (!response.data.articles || response.data.articles.length === 0) {
        console.warn('No articles found from NewsAPI.');
        return [];
      }

      // Map the API response to our NewsItem format
      const newsItems: NewsItem[] = await Promise.all(
        response.data.articles.map(async (article: any, index: number) => {
          const newsItem = mapArticleToNewsItem(article, index, 'NewsAPI');
          // Extract keywords for each article
          newsItem.keywords = await extractKeywords(newsItem);
          return newsItem;
        })
      );

      return newsItems;
    } catch (error) {
      console.error('Error fetching news from NewsAPI:', error);
      return [];
    }
  }

  getSourceName(): string {
    return 'NewsAPI';
  }
}

// GNews API implementation
class GNewsAPISource implements NewsSource {
  async fetchNews(category: NewsCategory = NewsCategory.All): Promise<NewsItem[]> {
    try {
      if (!GNEWS_API_KEY) {
        console.warn('No GNews API key found.');
        return [];
      }

      // Map our category to GNews API topic
      const apiTopic = mapCategoryToGNews(category);
      
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
          'User-Agent': 'InfoCloud/1.0'
        }
      });

      if (!response.data.articles || response.data.articles.length === 0) {
        return [];
      }

      return this.processArticles(response.data.articles);
    } catch (error) {
      console.error('Error fetching news from GNews API:', error);
      return [];
    }
  }

  private async processArticles(articles: any[]): Promise<NewsItem[]> {
    return await Promise.all(
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
        
        const newsItem = mapArticleToNewsItem(gNewsArticle, index, 'GNews');
        newsItem.keywords = await extractKeywords(newsItem);
        return newsItem;
      })
    );
  }

  getSourceName(): string {
    return 'GNews';
  }
}

// TheNewsAPI implementation
class TheNewsAPISource implements NewsSource {
  async fetchNews(category: NewsCategory = NewsCategory.All): Promise<NewsItem[]> {
    try {
      if (!THE_NEWS_API_KEY) {
        console.warn('No TheNewsAPI key found');
        return [];
      }

      // Log detailed API key information for debugging
      console.log(`TheNewsAPI key length: ${THE_NEWS_API_KEY.length}, first/last chars: ${THE_NEWS_API_KEY.substring(0, 3)}...${THE_NEWS_API_KEY.substring(THE_NEWS_API_KEY.length - 3)}`);

      // Map our category to TheNewsAPI category
      const apiCategory = mapCategoryToTheNewsAPI(category);
      
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
          return this.processArticles(topResponse.data.data);
        } else {
          console.warn('No top articles found from TheNewsAPI, trying all news endpoint');
        }
      } catch (error) {
        console.warn('Error fetching top news from TheNewsAPI, trying all news endpoint:', error);
      }
      
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
            return [];
          }
          
          return this.processArticles(domainsResponse.data.data);
        }
        
        console.log(`TheNewsAPI returned ${allResponse.data.data.length} all news articles`);
        return this.processArticles(allResponse.data.data);
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
            return this.processArticles(simpleResponse.data.data);
          }
        } catch (finalError) {
          console.error('Final attempt to fetch from TheNewsAPI failed:', finalError);
        }
        
        return [];
      }
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
      return [];
    }
  }

  /**
   * Process raw articles from TheNewsAPI into our standard NewsItem format
   * @param articles - Raw articles from TheNewsAPI
   * @returns Processed news items
   */
  private async processArticles(articles: any[]): Promise<NewsItem[]> {
    try {
      return await Promise.all(
        articles.map(async (article: any, index: number) => {
          try {
            // Ensure categories is always an array
            const categories = article.categories || [];
            
            // Map to standard format
            const theNewsAPIArticle = {
              title: article.title || 'No title available',
              description: article.description || article.snippet || 'No description available',
              url: article.url,
              source: {
                name: article.source || 'TheNewsAPI',
                id: 'thenewsapi'
              },
              publishedAt: article.published_at || article.publishedAt || new Date().toISOString(),
              section: Array.isArray(categories) ? categories.join(', ') : categories.toString()
            };
            
            // Convert to our standard NewsItem format
            const newsItem = mapArticleToNewsItem(theNewsAPIArticle, index, 'TheNewsAPI');
            
            // If we have categories from the API, try to map them to our internal categories
            if (categories && categories.length > 0) {
              // Use the first category as the primary one for mapping
              const primaryCategory = Array.isArray(categories) ? categories[0] : categories;
              newsItem.category = mapTheNewsAPIToCategory(primaryCategory) || newsItem.category;
            }
            
            // Extract keywords for each article
            newsItem.keywords = await extractKeywords(newsItem);
            
            return newsItem;
          } catch (error) {
            console.error(`Error processing article at index ${index}:`, error);
            // Return a placeholder for failed articles to maintain array length
            return createPlaceholderNewsItem(index, 'TheNewsAPI', 'Error processing article');
          }
        })
      );
    } catch (error) {
      console.error('Error processing articles batch:', error);
      return [];
    }
  }

  getSourceName(): string {
    return 'TheNewsAPI';
  }
}

// RSS Source implementation
class RSSSource implements NewsSource {
  async fetchNews(category: NewsCategory = NewsCategory.All): Promise<NewsItem[]> {
    try {
      const newsItems: NewsItem[] = [];
      let successfulFeeds = 0;
      let failedFeeds = 0;
      
      console.log('Starting to fetch RSS feeds...');
      
      // Check which feeds should be enabled based on localStorage settings
      const enabledFeeds = DEFAULT_RSS_FEEDS.filter(feed => {
        const feedId = `rssfeed_${feed.name.replace(/\s+/g, '_')}`;
        const savedSetting = localStorage.getItem(feedId);
        
        // If we have a saved setting, use that. Otherwise use the default (not disabled)
        if (savedSetting !== null) {
          return savedSetting === 'true';
        }
        return true;
      });
      
      console.log(`Using ${enabledFeeds.length} enabled feeds out of ${DEFAULT_RSS_FEEDS.length} total feeds`);
      
      // Fetch from all configured RSS feeds in parallel
      const feedPromises = enabledFeeds.map(async feed => {
        try {
          console.log(`Fetching RSS feed from: ${feed.name} (${feed.url})`);
          
          // Use our proxy endpoint instead of direct fetching
          const response = await axios.get('/api/rss-feed', {
            params: { url: feed.url },
            timeout: 15000
          });
          
          if (!response.data.success) {
            console.warn(`Proxy returned error for ${feed.name}: `, response.data.error);
            failedFeeds++;
            return;
          }
          
          let feedContent = response.data.feed;
          
          // Check if we received raw XML content that needs parsing
          if (response.data.rawContent && feedContent.rawXml) {
            console.log(`Received raw XML for ${feed.name}, parsing manually...`);
            try {
              feedContent = parseRawRssXml(feedContent.rawXml);
            } catch (parseError) {
              console.error(`Failed to parse raw XML for ${feed.name}:`, parseError);
              failedFeeds++;
              return;
            }
          }
          
          if (!feedContent || !feedContent.items) {
            console.warn(`No items found in RSS feed: ${feed.name}`);
            failedFeeds++;
            return;
          }
          
          console.log(`Successfully fetched ${feedContent.items.length} items from ${feed.name}`);
          
          // Map RSS items to our NewsItem format
          const items = await Promise.all(
            (feedContent.items || []).slice(0, 10).map(async (item: any, index: number) => {
              try {
                const newsItem: NewsItem = {
                  id: `RSS-${feed.name}-${index}-${Date.now()}`,
                  title: item.title || 'No title',
                  description: item.description || item.content || item.contentEncoded || item['content:encoded'] || 'No description',
                  url: item.link || item.url || '',
                  source: {
                    name: feed.name,
                    bias: analyzeMediaBias(feed.name)
                  },
                  publishedAt: item.published || item.pubDate || item.isoDate || new Date().toISOString(),
                  category: determineCategoryFromArticle(item),
                  keywords: [] as string[]
                };
                
                // Clean up description (remove HTML tags if present)
                newsItem.description = newsItem.description.replace(/<[^>]*>/g, '');
                
                // Extract keywords for each article
                newsItem.keywords = await extractKeywords(newsItem);
                return newsItem;
              } catch (itemError) {
                console.error(`Error processing RSS item from ${feed.name}:`, itemError);
                return null;
              }
            })
          );
          
          // Filter out any null items from errors and explicitly type as NewsItem[]
          const validItems: NewsItem[] = items.filter((item): item is NewsItem => item !== null);
          newsItems.push(...validItems);
          successfulFeeds++;
          
        } catch (error) {
          console.error(`Error fetching RSS feed ${feed.name} (${feed.url}):`, error);
          failedFeeds++;
        }
      });
      
      await Promise.all(feedPromises);
      
      console.log(`RSS feed fetch summary:
        - Successful feeds: ${successfulFeeds}
        - Failed feeds: ${failedFeeds}
        - Total news items: ${newsItems.length}`);
      
      // If we have a specific category, filter the items
      if (category !== NewsCategory.All) {
        const filteredItems = newsItems.filter(item => item.category === category);
        console.log(`Filtered ${newsItems.length} items to ${filteredItems.length} items for category: ${category}`);
        return filteredItems;
      }
      
      return newsItems;
    } catch (error) {
      console.error('Error in RSS fetchNews:', error);
      return [];
    }
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

// Function to fetch news from multiple API sources
const fetchNewsFromAPI = async (category: NewsCategory = NewsCategory.All): Promise<NewsItem[]> => {
  try {
    // Check if any API keys are available
    const hasKeys = NEWS_API_KEY || GNEWS_API_KEY || THE_NEWS_API_KEY;
    
    if (!hasKeys) {
      console.warn('No API keys found. Returning empty array.');
      return [];
    }

    // Fetch from all available sources in parallel
    const sourcesWithKeys = newsSources.filter(source => {
      // Check both API key and debug toggle
      if (source instanceof NewsAPISource) {
        return NEWS_API_KEY && isApiEnabled('NewsAPI');
      }
      if (source instanceof GNewsAPISource) {
        return GNEWS_API_KEY && isApiEnabled('GNews');
      }
      if (source instanceof TheNewsAPISource) {
        return THE_NEWS_API_KEY && isApiEnabled('TheNewsAPI');
      }
      if (source instanceof RSSSource) {
        return isApiEnabled('RSS');
      }
      return false;
    });

    // If no sources are enabled in debug panel, return an empty array (no news)
    if (sourcesWithKeys.length === 0) {
      console.warn('No enabled API sources. Returning empty array.');
      return [];
    }

    const allNewsPromises = sourcesWithKeys.map(source => source.fetchNews(category));
    const allNewsResults = await Promise.all(allNewsPromises);
    
    // Store working status in localStorage for the debug panel
    sourcesWithKeys.forEach((source, index) => {
      const result = allNewsResults[index];
      const isWorking = Array.isArray(result) && result.length > 0;
      let apiName = '';
      
      if (source instanceof NewsAPISource) apiName = 'NewsAPI';
      else if (source instanceof GNewsAPISource) apiName = 'GNews';
      else if (source instanceof TheNewsAPISource) apiName = 'TheNewsAPI';
      else if (source instanceof RSSSource) apiName = 'RSS';
      
      if (apiName) {
        localStorage.setItem(`api_${apiName.replace(/\s+/g, '')}_working`, isWorking ? 'true' : 'false');
      }
    });
    
    // Combine all results
    let combinedNews: NewsItem[] = allNewsResults.flat();
    
    if (combinedNews.length === 0) {
      console.warn('No articles found from any API.');
      return [];
    }

    // Deduplicate articles with the same title (from different sources)
    const uniqueTitles = new Set<string>();
    combinedNews = combinedNews.filter(item => {
      if (uniqueTitles.has(item.title)) {
        return false;
      }
      uniqueTitles.add(item.title);
      return true;
    });

    return combinedNews;
  } catch (error) {
    console.error('Error fetching news from APIs:', error);
    return [];
  }
};

// Helper function to map our category to NewsAPI category
const mapCategoryToNewsAPI = (category: NewsCategory): string | null => {
  switch (category) {
    case NewsCategory.Business: return 'business';
    case NewsCategory.Entertainment: return 'entertainment';
    case NewsCategory.Health: return 'health';
    case NewsCategory.Science: return 'science';
    case NewsCategory.Sports: return 'sports';
    case NewsCategory.Tech: return 'technology';
    case NewsCategory.US: return 'politics';
    case NewsCategory.World: return 'world';
    case NewsCategory.All: return 'general';
    default: return null;
  }
};

// Helper function to map our category to GNews topics
const mapCategoryToGNews = (category: NewsCategory): string | null => {
  switch (category) {
    case NewsCategory.Business: return 'business';
    case NewsCategory.Entertainment: return 'entertainment';
    case NewsCategory.Health: return 'health';
    case NewsCategory.Science: return 'science';
    case NewsCategory.Sports: return 'sports';
    case NewsCategory.Tech: return 'technology';
    case NewsCategory.World: return 'world';
    case NewsCategory.US: return 'nation';
    case NewsCategory.All: return null;
    default: return null;
  }
};

// Helper function to map our category to TheNewsAPI category
const mapCategoryToTheNewsAPI = (category: NewsCategory): string | null => {
  switch (category) {
    case NewsCategory.Business: return 'business';
    case NewsCategory.Entertainment: return 'entertainment';
    case NewsCategory.Health: return 'health';
    case NewsCategory.Science: return 'science';
    case NewsCategory.Sports: return 'sports';
    case NewsCategory.Tech: return 'tech';  // TheNewsAPI uses 'tech' instead of 'technology'
    case NewsCategory.US: return 'politics';
    case NewsCategory.World: return 'world';
    case NewsCategory.All: return 'general';
    default: return null;
  }
};

// Helper function to map API article to our NewsItem format
const mapArticleToNewsItem = (article: any, index: number, apiSource: string): NewsItem => {
  return {
    id: `${apiSource}-${index}-${Date.now()}`,
    title: article.title || 'No title',
    description: article.description || 'No description',
    url: article.url,
    source: {
      name: article.source?.name || apiSource,
      bias: analyzeMediaBias(article.source?.name || apiSource)
    },
    publishedAt: article.publishedAt || article.published_at || new Date().toISOString(),
    category: determineCategoryFromArticle(article),
    keywords: [] // Will be filled by extractKeywords function
  };
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
  'when', 'where', 'which', 'while', 'who', 'with', 'would', 'you', 'your'
];

// List of media source names to filter out from keywords
const mediaSourceNames = [
  // Mainstream Left
  'cnn', 'msnbc', 'new york times', 'the new york times', 'washington post',
  'npr', 'abc news', 'cbs news', 'nbc news', 'time', 
  
  // Alternative Left
  'mother jones', 'the nation', 'democracy now', 'huffington post', 'vox',
  'vanity fair', 'the new yorker', 'fair', 'truthout', 'alternet', 
  'the intercept', 'truthdig', 'raw story',
  
  // Centrist
  'associated press', 'reuters', 'bbc', 'christian science monitor',
  'axios', 'bloomberg', 'usa today', 'the hill', 'pbs',
  
  // Mainstream Right
  'wall street journal', 'washington times', 'national review', 'fox news',
  'new york post', 'forbes',
  
  // Alternative Right
  'the daily wire', 'the american conservative', 'breitbart', 'the daily caller',
  'the political insider', 'the unz review', 'newsmax',
  
  // Mixed/Financial
  'the economist', 'financial times', 'cnbc',
  
  // International
  'al jazeera', 'the guardian', 'deutsche welle', 'france 24', 'times of india',
  
  // Shortened forms that might appear
  'breitbart', 'fox', 'dailywire', 'dailycaller', 'nytimes', 'wapo'
];

// Helper function to create a placeholder news item for error cases
const createPlaceholderNewsItem = (index: number, sourceName: string, errorMessage: string): NewsItem => {
  return {
    id: `error-${sourceName}-${index}-${Date.now()}`,
    title: `Error processing article from ${sourceName}`,
    description: errorMessage,
    url: '',
    source: {
      name: sourceName,
      bias: PoliticalBias.Unclear
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.All,
    keywords: []
  };
};

// Extract keywords from a news item
const extractKeywords = async (newsItem: NewsItem): Promise<string[]> => {
  // Combine title and description for better keyword extraction
  const text = `${newsItem.title} ${newsItem.description}`;
  
  try {
    // Use compromise NLP to extract various types of terms
    const doc = nlp(text);
    
    // Get topics (main subjects)
    const topics = doc.topics().json({ normal: true });
    
    // Get all nouns (including proper nouns)
    const nouns = doc.nouns().json({ normal: true });
    
    // Get organizations and company names
    const organizations = doc.organizations().json({ normal: true });
    
    // Get places and locations
    const places = doc.places().json({ normal: true });
    
    // Get verbs (actions) - can be important in news context
    const verbs = doc.verbs().json({ normal: true });
    
    // Combine all terms and remove duplicates
    const allTerms = [
      ...topics,
      ...nouns,
      ...organizations,
      ...places,
      ...verbs
    ].map(term => term.normal || term.text);
    
    const uniqueTerms = Array.from(new Set(allTerms));
    
    // Filter out stop words, short terms, numbers, and source names
    const filteredTerms = uniqueTerms.filter(term => {
      const lowerTerm = term.toLowerCase();
      return (
        term.length > 2 && // Allow slightly shorter terms
        !/^\d+$/.test(term) && // Filter out pure numbers
        !stopWords.includes(lowerTerm) && // Filter out stop words
        !mediaSourceNames.some(source => lowerTerm === source || lowerTerm.includes(source)) // Filter out source names
      );
    });
    
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
        !mediaSourceNames.some(source => word === source || word.includes(source))
      )
      .slice(0, 10);
  }
};

// Analyze political bias of a media source
const analyzeMediaBias = (sourceName: string): PoliticalBias => {
  // This is a simplified mapping of news sources to political bias
  const sourceMapping: Record<string, PoliticalBias> = {
    // Mainstream Left
    'CNN': PoliticalBias.MainstreamLeft,
    'MSNBC': PoliticalBias.MainstreamLeft,
    'New York Times': PoliticalBias.MainstreamLeft,
    'The New York Times': PoliticalBias.MainstreamLeft,
    'Washington Post': PoliticalBias.MainstreamLeft,
    'NPR': PoliticalBias.MainstreamLeft,
    'ABC News': PoliticalBias.MainstreamLeft,
    'CBS News': PoliticalBias.MainstreamLeft,
    'NBC News': PoliticalBias.MainstreamLeft,
    'Time': PoliticalBias.MainstreamLeft,
    
    // Alternative Left
    'Mother Jones': PoliticalBias.AlternativeLeft,
    'The Nation': PoliticalBias.AlternativeLeft,
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
    
    // Mainstream Right
    'Wall Street Journal': PoliticalBias.MainstreamRight,
    'Washington Times': PoliticalBias.MainstreamRight,
    'National Review': PoliticalBias.MainstreamRight,
    'Fox News': PoliticalBias.MainstreamRight,
    'New York Post': PoliticalBias.MainstreamRight,
    'Forbes': PoliticalBias.MainstreamRight,
    
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
    'The Guardian': PoliticalBias.MainstreamLeft,
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

// Helper to determine category from an article when the API doesn't provide it
const determineCategoryFromArticle = (article: any): NewsCategory => {
  // Try to use the section, category, or topic provided by the API
  const sectionName = article.section || article.category || article.topic;
  
  if (sectionName) {
    const lowerSection = sectionName.toLowerCase();
    
    if (lowerSection.includes('business')) {
      return NewsCategory.Business;
    }
    if (lowerSection.includes('finance') || lowerSection.includes('market') || lowerSection.includes('stock')) {
      return NewsCategory.Finance;
    }
    if (lowerSection.includes('entertainment')) {
      return NewsCategory.Entertainment;
    }
    if (lowerSection.includes('art') || lowerSection.includes('culture') || lowerSection.includes('museum')) {
      return NewsCategory.Art;
    }
    if (lowerSection.includes('health') || lowerSection.includes('wellness')) {
      return NewsCategory.Health;
    }
    if (lowerSection.includes('science')) {
      return NewsCategory.Science;
    }
    if (lowerSection.includes('space') || lowerSection.includes('astronomy') || lowerSection.includes('nasa')) {
      return NewsCategory.Space;
    }
    if (lowerSection.includes('education') || lowerSection.includes('school') || lowerSection.includes('university')) {
      return NewsCategory.Education;
    }
    if (lowerSection.includes('environment') || lowerSection.includes('climate')) {
      return NewsCategory.Environment;
    }
    if (lowerSection.includes('sport') || lowerSection.includes('sports')) {
      return NewsCategory.Sports;
    }
    if (lowerSection.includes('tech') || lowerSection.includes('technology')) {
      return NewsCategory.Tech;
    }
    if (lowerSection.includes('ai') || lowerSection.includes('artificial intelligence') || lowerSection.includes('machine learning')) {
      return NewsCategory.AI;
    }
    if (lowerSection.includes('politics') || lowerSection.includes('election')) {
      return NewsCategory.Politics;
    }
    if (lowerSection.includes('military') || lowerSection.includes('defense')) {
      return NewsCategory.Military;
    }
    if (lowerSection.includes('crime') || lowerSection.includes('police') || lowerSection.includes('court')) {
      return NewsCategory.Crime;
    }
    if (lowerSection.includes('us') || lowerSection.includes('nation')) {
      return NewsCategory.US;
    }
    if (lowerSection.includes('world') || lowerSection.includes('international')) {
      return NewsCategory.World;
    }
  }
  
  // If we couldn't determine the category, try analyzing the title
  const title = article.title || '';
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('business')) {
    return NewsCategory.Business;
  }
  if (lowerTitle.includes('finance') || lowerTitle.includes('market') || lowerTitle.includes('stock')) {
    return NewsCategory.Finance;
  }
  if (lowerTitle.includes('entertainment')) {
    return NewsCategory.Entertainment;
  }
  if (lowerTitle.includes('art') || lowerTitle.includes('artist') || lowerTitle.includes('museum')) {
    return NewsCategory.Art;
  }
  if (lowerTitle.includes('health') || lowerTitle.includes('medicine') || lowerTitle.includes('covid')) {
    return NewsCategory.Health;
  }
  if (lowerTitle.includes('science') || lowerTitle.includes('research')) {
    return NewsCategory.Science;
  }
  if (lowerTitle.includes('space') || lowerTitle.includes('nasa') || lowerTitle.includes('astronomy')) {
    return NewsCategory.Space;
  }
  if (lowerTitle.includes('education') || lowerTitle.includes('school') || lowerTitle.includes('university')) {
    return NewsCategory.Education;
  }
  if (lowerTitle.includes('environment') || lowerTitle.includes('climate')) {
    return NewsCategory.Environment;
  }
  if (lowerTitle.includes('sport') || lowerTitle.includes('game') || lowerTitle.includes('team')) {
    return NewsCategory.Sports;
  }
  if (lowerTitle.includes('tech') || lowerTitle.includes('digital')) {
    return NewsCategory.Tech;
  }
  if (lowerTitle.includes('ai') || lowerTitle.includes('artificial intelligence') || lowerTitle.includes('machine learning') || lowerTitle.includes('chatgpt')) {
    return NewsCategory.AI;
  }
  if (lowerTitle.includes('politic') || lowerTitle.includes('election')) {
    return NewsCategory.Politics;
  }
  if (lowerTitle.includes('military') || lowerTitle.includes('defense') || lowerTitle.includes('war')) {
    return NewsCategory.Military;
  }
  if (lowerTitle.includes('crime') || lowerTitle.includes('police') || lowerTitle.includes('court')) {
    return NewsCategory.Crime;
  }
  if (lowerTitle.includes('congress') || lowerTitle.includes('senate')) {
    return NewsCategory.US;
  }
  if (lowerTitle.includes('world') || lowerTitle.includes('global') || lowerTitle.includes('international')) {
    return NewsCategory.World;
  }
  
  // Default to All category if we couldn't determine
  return NewsCategory.All;
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

export {
  fetchNewsFromAPI,
  extractKeywords,
  analyzeMediaBias,
  saveTimeSnapshot,
  getTimeSnapshot
};
