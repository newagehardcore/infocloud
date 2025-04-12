import axios from 'axios';
import nlp from 'compromise';
import { NewsItem, PoliticalBias, NewsCategory, TimeSnapshot } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Get the API keys from environment variables
const NEWS_API_KEY = process.env.REACT_APP_NEWS_API_KEY;
const GNEWS_API_KEY = process.env.REACT_APP_GNEWS_API_KEY;
const THE_NEWS_API_KEY = process.env.REACT_APP_THE_NEWS_API_KEY;

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
    case 'politics': return NewsCategory.US;
    case 'world': return NewsCategory.World;
    case 'general': return NewsCategory.All;
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

// Initialize the news sources
const newsSources: NewsSource[] = [
  new NewsAPISource(),
  new GNewsAPISource(),
  new TheNewsAPISource()
];

// Helper function to check if an API is enabled in localStorage
const isApiEnabled = (apiName: string, defaultValue: boolean = true): boolean => {
  const storedValue = localStorage.getItem(`api_${apiName.replace(/\s+/g, '')}_enabled`);
  return storedValue === null ? defaultValue : storedValue === 'true';
};

// Function to fetch news from multiple API sources
export const fetchNewsFromAPI = async (category: NewsCategory = NewsCategory.All): Promise<NewsItem[]> => {
  try {
    // Check if any API keys are available
    const hasKeys = NEWS_API_KEY || GNEWS_API_KEY || THE_NEWS_API_KEY;
    
    if (!hasKeys) {
      console.warn('No API keys found. Using mock data instead.');
      return getMockNewsData(category);
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
      
      if (apiName) {
        localStorage.setItem(`api_${apiName.replace(/\s+/g, '')}_working`, isWorking ? 'true' : 'false');
      }
    });
    
    // Combine all results
    let combinedNews: NewsItem[] = allNewsResults.flat();
    
    if (combinedNews.length === 0) {
      console.warn('No articles found from any API. Using mock data instead.');
      return getMockNewsData(category);
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
    console.warn('Falling back to mock data.');
    return getMockNewsData(category);
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
    case NewsCategory.US: return null; // Use country=us parameter instead
    case NewsCategory.World: return null; // Not directly mappable
    case NewsCategory.All: return null;
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

// Extract keywords from a news item
export const extractKeywords = async (newsItem: NewsItem): Promise<string[]> => {
  // Combine title and description for better keyword extraction
  const text = `${newsItem.title} ${newsItem.description}`;
  
  try {
    // Use compromise NLP to extract nouns and noun phrases
    const doc = nlp(text);
    const topics = doc.topics().json({ normal: true });
    const nouns = doc.nouns().json({ normal: true });
    
    // Combine topics and nouns, remove duplicates
    const allTerms = [...topics, ...nouns].map(term => term.normal || term.text);
    const uniqueTerms = Array.from(new Set(allTerms));
    
    // Filter out stop words and short terms
    const filteredTerms = uniqueTerms.filter(
      term => term.length > 3 && !stopWords.includes(term.toLowerCase())
    );
    
    // Return top 10 keywords
    return filteredTerms.slice(0, 10);
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return [];
  }
};

// Analyze political bias of a media source
export const analyzeMediaBias = (sourceName: string): PoliticalBias => {
  // This is a simplified mapping of news sources to political bias
  // In a real application, this would be based on a comprehensive database or API
  const sourceMapping: Record<string, PoliticalBias> = {
    'CNN': PoliticalBias.MainstreamLeft,
    'MSNBC': PoliticalBias.MainstreamLeft,
    'New York Times': PoliticalBias.MainstreamLeft,
    'The New York Times': PoliticalBias.MainstreamLeft,
    'Washington Post': PoliticalBias.MainstreamLeft,
    'Huffington Post': PoliticalBias.AlternativeLeft,
    'Vox': PoliticalBias.AlternativeLeft,
    'Associated Press': PoliticalBias.Centrist,
    'Reuters': PoliticalBias.Centrist,
    'Bloomberg': PoliticalBias.Centrist,
    'BBC': PoliticalBias.Centrist,
    'The Guardian': PoliticalBias.MainstreamLeft,
    'NPR': PoliticalBias.MainstreamLeft,
    'Fox News': PoliticalBias.MainstreamRight,
    'Wall Street Journal': PoliticalBias.MainstreamRight,
    'New York Post': PoliticalBias.MainstreamRight,
    'Breitbart': PoliticalBias.AlternativeRight,
    'The Daily Caller': PoliticalBias.AlternativeRight,
    'CNBC': PoliticalBias.Centrist,
    'ABC News': PoliticalBias.MainstreamLeft,
    'CBS News': PoliticalBias.MainstreamLeft,
    'NBC News': PoliticalBias.MainstreamLeft,
    'Politico': PoliticalBias.MainstreamLeft,
    'The Hill': PoliticalBias.Centrist,
    'Forbes': PoliticalBias.MainstreamRight,
    'Time': PoliticalBias.MainstreamLeft,
    'Newsweek': PoliticalBias.MainstreamLeft,
    'USA Today': PoliticalBias.Centrist,
    'The Atlantic': PoliticalBias.MainstreamLeft,
    'National Review': PoliticalBias.MainstreamRight
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
    
    if (lowerSection.includes('business') || lowerSection.includes('finance') || lowerSection.includes('economy')) {
      return NewsCategory.Business;
    }
    if (lowerSection.includes('entertainment') || lowerSection.includes('culture') || lowerSection.includes('arts')) {
      return NewsCategory.Entertainment;
    }
    if (lowerSection.includes('health') || lowerSection.includes('wellness')) {
      return NewsCategory.Health;
    }
    if (lowerSection.includes('science') || lowerSection.includes('environment')) {
      return NewsCategory.Science;
    }
    if (lowerSection.includes('sport') || lowerSection.includes('sports')) {
      return NewsCategory.Sports;
    }
    if (lowerSection.includes('tech') || lowerSection.includes('technology')) {
      return NewsCategory.Tech;
    }
    if (lowerSection.includes('us') || lowerSection.includes('nation') || lowerSection.includes('politics')) {
      return NewsCategory.US;
    }
    if (lowerSection.includes('world') || lowerSection.includes('international')) {
      return NewsCategory.World;
    }
  }
  
  // If we couldn't determine the category, try analyzing the title
  const title = article.title || '';
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('business') || lowerTitle.includes('economy') || lowerTitle.includes('market')) {
    return NewsCategory.Business;
  }
  if (lowerTitle.includes('entertainment') || lowerTitle.includes('movie') || lowerTitle.includes('music')) {
    return NewsCategory.Entertainment;
  }
  if (lowerTitle.includes('health') || lowerTitle.includes('medicine') || lowerTitle.includes('covid')) {
    return NewsCategory.Health;
  }
  if (lowerTitle.includes('science') || lowerTitle.includes('research') || lowerTitle.includes('study')) {
    return NewsCategory.Science;
  }
  if (lowerTitle.includes('sport') || lowerTitle.includes('game') || lowerTitle.includes('team')) {
    return NewsCategory.Sports;
  }
  if (lowerTitle.includes('tech') || lowerTitle.includes('ai') || lowerTitle.includes('digital')) {
    return NewsCategory.Tech;
  }
  if (lowerTitle.includes('politic') || lowerTitle.includes('congress') || lowerTitle.includes('senate')) {
    return NewsCategory.US;
  }
  if (lowerTitle.includes('world') || lowerTitle.includes('global') || lowerTitle.includes('international')) {
    return NewsCategory.World;
  }
  
  // Default to All category if we couldn't determine
  return NewsCategory.All;
};

export const saveTimeSnapshot = (snapshot: TimeSnapshot): void => {
  console.log('Saving time snapshot:', snapshot);
  // Implementation will depend on storage mechanism (localStorage, IndexedDB, server API, etc.)
};

export const getTimeSnapshot = (timestamp: string): TimeSnapshot | null => {
  console.log('Getting time snapshot for:', timestamp);
  // Implementation will depend on storage mechanism
  return null;
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

// Mock news data for development
const getMockNewsData = (category: NewsCategory): NewsItem[] => {
  const allNews = mockNewsData;
  
  if (category === NewsCategory.All) {
    return allNews;
  }
  
  return allNews.filter(item => item.category === category);
};

// Enhanced mock news data with more realistic content
const mockNewsData: NewsItem[] = [
  {
    id: '1',
    title: 'Tech Giants Announce New AI Ethics Coalition',
    description: 'Major technology companies including Google, Microsoft, and OpenAI have formed a partnership to develop ethical standards for artificial intelligence development and deployment.',
    url: 'https://example.com/tech-ai-ethics-coalition',
    source: {
      name: 'Tech Today',
      bias: PoliticalBias.Centrist
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.Tech,
    keywords: ['artificial intelligence', 'ethics', 'technology', 'standards', 'coalition']
  },
  {
    id: '2',
    title: 'Global Climate Summit Reaches Historic Carbon Agreement',
    description: 'World leaders at the UN Climate Summit have agreed on ambitious new targets to reduce carbon emissions by 50% by 2030, with developing nations receiving financial support for green transitions.',
    url: 'https://example.com/climate-summit-agreement',
    source: {
      name: 'World News Network',
      bias: PoliticalBias.MainstreamLeft
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.World,
    keywords: ['climate', 'carbon', 'emissions', 'agreement', 'summit']
  },
  {
    id: '3',
    title: 'Stock Market Reaches All-Time High on Tech Earnings',
    description: 'The S&P 500 and Nasdaq closed at record highs today, driven by stronger-than-expected earnings reports from major technology companies and positive economic indicators.',
    url: 'https://example.com/stock-market-record-high',
    source: {
      name: 'Business Daily',
      bias: PoliticalBias.MainstreamRight
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.Business,
    keywords: ['stock market', 'earnings', 'technology', 'economy', 'record']
  },
  {
    id: '4',
    title: 'Universal Healthcare Bill Introduced in Congress',
    description: 'Progressive lawmakers have introduced a comprehensive healthcare reform bill aimed at establishing a single-payer system that would provide coverage to all Americans regardless of income.',
    url: 'https://example.com/universal-healthcare-bill',
    source: {
      name: 'Progressive Voice',
      bias: PoliticalBias.AlternativeLeft
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.US,
    keywords: ['healthcare', 'congress', 'single-payer', 'reform', 'progressive']
  },
  {
    id: '5',
    title: 'NASA and SpaceX Announce 2028 Mars Mission Timeline',
    description: 'NASA in partnership with SpaceX has set a target date of 2028 for the first human mission to Mars, with preparations for habitat construction and life support systems already underway.',
    url: 'https://example.com/nasa-spacex-mars-mission',
    source: {
      name: 'Science Today',
      bias: PoliticalBias.Centrist
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.Science,
    keywords: ['NASA', 'SpaceX', 'Mars', 'mission', 'space exploration']
  },
  {
    id: '6',
    title: 'Underdog Team Wins Championship in Overtime Thriller',
    description: 'In one of the most dramatic finals in recent history, the underdog team overcame a 15-point deficit to win the national championship in overtime, ending a 25-year title drought.',
    url: 'https://example.com/championship-overtime-thriller',
    source: {
      name: 'Sports Network',
      bias: PoliticalBias.Unclear
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.Sports,
    keywords: ['championship', 'overtime', 'underdog', 'comeback', 'sports']
  },
  {
    id: '7',
    title: 'New Study Shows Mediterranean Diet Reduces Heart Disease Risk by 30%',
    description: 'A comprehensive 10-year study involving over 100,000 participants has confirmed that following a Mediterranean diet can significantly reduce the risk of heart disease and stroke compared to typical Western diets.',
    url: 'https://example.com/mediterranean-diet-heart-study',
    source: {
      name: 'Health Journal',
      bias: PoliticalBias.Centrist
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.Health,
    keywords: ['Mediterranean diet', 'heart disease', 'health', 'nutrition', 'research']
  },
  {
    id: '8',
    title: 'Streaming Platform Announces $200M Budget for New Sci-Fi Series',
    description: 'A major streaming service has revealed plans for its most expensive original production yet, a high-concept science fiction series from acclaimed directors with a $200 million budget for the first season.',
    url: 'https://example.com/streaming-scifi-series-budget',
    source: {
      name: 'Entertainment Weekly',
      bias: PoliticalBias.MainstreamLeft
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.Entertainment,
    keywords: ['streaming', 'science fiction', 'television', 'production', 'entertainment']
  },
  {
    id: '9',
    title: 'Government Proposes Tax Cuts for Middle-Income Families',
    description: 'The administration has unveiled a tax reform proposal that would reduce rates for households earning between $50,000 and $100,000 annually while increasing capital gains taxes on high-income earners.',
    url: 'https://example.com/middle-class-tax-cuts',
    source: {
      name: 'Conservative Tribune',
      bias: PoliticalBias.AlternativeRight
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.US,
    keywords: ['tax cuts', 'middle class', 'government', 'reform', 'economy']
  },
  {
    id: '10',
    title: 'Revolutionary Battery Technology Doubles Electric Vehicle Range',
    description: 'Scientists have developed a new solid-state battery technology that could double the range of electric vehicles while reducing charging time to under 10 minutes, potentially accelerating EV adoption.',
    url: 'https://example.com/battery-technology-breakthrough',
    source: {
      name: 'Tech Review',
      bias: PoliticalBias.MainstreamLeft
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.Tech,
    keywords: ['battery', 'electric vehicles', 'technology', 'innovation', 'energy']
  },
  {
    id: '11',
    title: 'International Tensions Rise Over Disputed Territory',
    description: 'Diplomatic relations have deteriorated as two nations claim sovereignty over a resource-rich border region, with military forces conducting exercises nearby and global powers calling for de-escalation.',
    url: 'https://example.com/international-territory-dispute',
    source: {
      name: 'Global Affairs',
      bias: PoliticalBias.Centrist
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.World,
    keywords: ['international', 'territory', 'dispute', 'diplomatic', 'military']
  },
  {
    id: '12',
    title: 'Breakthrough Drug Shows Promise in Alzheimer\'s Treatment',
    description: 'A new pharmaceutical treatment has demonstrated significant reduction in cognitive decline during late-stage clinical trials, potentially offering the first effective therapy for Alzheimer\'s disease progression.',
    url: 'https://example.com/alzheimers-drug-breakthrough',
    source: {
      name: 'Medical News',
      bias: PoliticalBias.Centrist
    },
    publishedAt: new Date().toISOString(),
    category: NewsCategory.Health,
    keywords: ['Alzheimer\'s', 'treatment', 'pharmaceutical', 'clinical trials', 'medicine']
  }
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

export default {
  fetchNewsFromAPI,
  extractKeywords,
  analyzeMediaBias,
  saveTimeSnapshot,
  getTimeSnapshot
};
