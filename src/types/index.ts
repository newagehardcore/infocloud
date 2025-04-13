export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: {
    name: string;
    bias: PoliticalBias;
  };
  publishedAt: string;
  category: NewsCategory;
  keywords: string[];
}

export enum PoliticalBias {
  MainstreamLeft = 'mainstream-left',
  AlternativeLeft = 'alternative-left',
  Centrist = 'centrist',
  MainstreamRight = 'mainstream-right',
  AlternativeRight = 'alternative-right',
  Unclear = 'unclear'
}

export enum NewsCategory {
  All = 'all',
  World = 'world',
  US = 'us',
  Politics = 'politics',
  Tech = 'tech',
  AI = 'ai',
  Business = 'business',
  Finance = 'finance',
  Entertainment = 'entertainment',
  Art = 'art',
  Sports = 'sports',
  Health = 'health',
  Science = 'science',
  Education = 'education',
  Environment = 'environment',
  Military = 'military',
  Crime = 'crime',
  Space = 'space'
}

export interface TagCloudWord {
  text: string;
  value: number; // frequency/importance
  bias: PoliticalBias;
  newsIds: string[]; // IDs of news items containing this word
  category: NewsCategory;
}

export interface TimeSnapshot {
  timestamp: string;
  words: TagCloudWord[];
  newsItems: NewsItem[];
}
