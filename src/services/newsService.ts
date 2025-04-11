import axios from 'axios';
import nlp from 'compromise';
import { NewsItem, PoliticalBias, NewsCategory, TimeSnapshot } from '../types';

// Get the API key from environment variables
const NEWS_API_KEY = process.env.REACT_APP_NEWS_API_KEY;

// Function to fetch news from NewsAPI.org
export const fetchNewsFromAPI = async (category: NewsCategory = NewsCategory.All): Promise<NewsItem[]> => {
  try {
    if (!NEWS_API_KEY) {
      console.warn('No NewsAPI key found. Using mock data instead.');
      return getMockNewsData(category);
    }

    // Map our category to NewsAPI category
    const apiCategory = mapCategoryToNewsAPI(category);
    
    // Fetch real data from NewsAPI
    const response = await axios.get(
      `https://newsapi.org/v2/top-headlines?country=us${apiCategory ? `&category=${apiCategory}` : ''}`,
      { headers: { 'X-Api-Key': NEWS_API_KEY } }
    );

    if (!response.data.articles || response.data.articles.length === 0) {
      console.warn('No articles found from NewsAPI. Using mock data instead.');
      return getMockNewsData(category);
    }

    // Map the API response to our NewsItem format
    const newsItems: NewsItem[] = await Promise.all(
      response.data.articles.map(async (article: any, index: number) => {
        const newsItem = mapArticleToNewsItem(article, index);
        // Extract keywords for each article
        newsItem.keywords = await extractKeywords(newsItem);
        return newsItem;
      })
    );

    return newsItems;
  } catch (error) {
    console.error('Error fetching news from NewsAPI:', error);
    console.warn('Falling back to mock data.');
    return getMockNewsData(category);
  }
};

// Function to extract keywords from news items using NLP
export const extractKeywords = (newsItem: NewsItem): string[] => {
  // Combine title and description for better keyword extraction
  const text = `${newsItem.title} ${newsItem.description}`;
  
  // Use compromise for entity and term extraction
  const doc = nlp(text);
  
  // Extract entities and terms
  const entities = new Set([
    ...doc.people().out('array'),
    ...doc.places().out('array'),
    ...doc.organizations().out('array')
  ]);

  // Extract nouns and verbs that aren't already in entities
  const terms = doc.match('#Noun|#Verb')
    .not('#Pronoun')
    .out('array')
    .filter((term: string) => term.length > 3)
    .filter((term: string) => !stopWords.includes(term.toLowerCase()));

  // Combine entities and terms
  const keywords = new Set([
    ...Array.from(entities),
    ...terms
  ]);
  
  // Return unique keywords, limited to 5
  return Array.from(keywords).slice(0, 5);
};

// Function to analyze media bias
// In a real application, this would use a database of media sources and their biases
export const analyzeMediaBias = (sourceName: string): PoliticalBias => {
  // This is a simplified version for demonstration
  // In a real application, this would use a more comprehensive database
  const sourceNameLower = sourceName.toLowerCase();
  
  // Example media bias mapping (very simplified)
  if (sourceNameLower.includes('cnn') || 
      sourceNameLower.includes('msnbc') || 
      sourceNameLower.includes('washington post')) {
    return PoliticalBias.MainstreamLeft;
  } else if (sourceNameLower.includes('huffington') || 
             sourceNameLower.includes('vox') || 
             sourceNameLower.includes('daily kos')) {
    return PoliticalBias.AlternativeLeft;
  } else if (sourceNameLower.includes('fox') || 
             sourceNameLower.includes('new york post') || 
             sourceNameLower.includes('washington times')) {
    return PoliticalBias.MainstreamRight;
  } else if (sourceNameLower.includes('breitbart') || 
             sourceNameLower.includes('daily caller') || 
             sourceNameLower.includes('newsmax')) {
    return PoliticalBias.AlternativeRight;
  } else if (sourceNameLower.includes('reuters') || 
             sourceNameLower.includes('associated press') || 
             sourceNameLower.includes('bbc')) {
    return PoliticalBias.Centrist;
  }
  
  return PoliticalBias.Unclear;
};

// Function to save a time snapshot
export const saveTimeSnapshot = (words: any[], newsItems: NewsItem[]): TimeSnapshot => {
  return {
    timestamp: new Date().toISOString(),
    words,
    newsItems
  };
};

// Function to get a time snapshot for a specific time
// In a real application, this would fetch from a database
export const getTimeSnapshot = async (time: Date): Promise<TimeSnapshot | null> => {
  // For demonstration, we'll return mock data
  // In a real application, this would fetch from a database based on the timestamp
  return {
    timestamp: time.toISOString(),
    words: [],
    newsItems: getMockNewsData(NewsCategory.All)
  };
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

// Helper function to map NewsAPI article to our NewsItem format
const mapArticleToNewsItem = (article: any, index: number): NewsItem => {
  return {
    id: `${index}-${Date.now()}`,
    title: article.title || 'No title',
    description: article.description || 'No description',
    url: article.url,
    source: {
      name: article.source.name,
      bias: analyzeMediaBias(article.source.name)
    },
    publishedAt: article.publishedAt,
    category: determineCategoryFromArticle(article),
    keywords: [] // Will be filled by extractKeywords function
  };
};

// Helper function to determine category from article
const determineCategoryFromArticle = (article: any): NewsCategory => {
  // This is a simplified version for demonstration
  // In a real application, this would use NLP to categorize the article
  const title = (article.title || '').toLowerCase();
  const description = (article.description || '').toLowerCase();
  const content = `${title} ${description}`;
  
  if (content.includes('business') || content.includes('economy') || content.includes('market')) {
    return NewsCategory.Business;
  } else if (content.includes('entertainment') || content.includes('movie') || content.includes('celebrity')) {
    return NewsCategory.Entertainment;
  } else if (content.includes('health') || content.includes('medical') || content.includes('disease')) {
    return NewsCategory.Health;
  } else if (content.includes('science') || content.includes('research') || content.includes('study')) {
    return NewsCategory.Science;
  } else if (content.includes('sports') || content.includes('game') || content.includes('player')) {
    return NewsCategory.Sports;
  } else if (content.includes('tech') || content.includes('technology') || content.includes('digital')) {
    return NewsCategory.Tech;
  } else if (content.includes('world') || content.includes('international') || content.includes('global')) {
    return NewsCategory.World;
  } else if (content.includes('us') || content.includes('united states') || content.includes('america')) {
    return NewsCategory.US;
  }
  
  return NewsCategory.All;
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

export default {
  fetchNewsFromAPI,
  extractKeywords,
  analyzeMediaBias,
  saveTimeSnapshot,
  getTimeSnapshot
};
