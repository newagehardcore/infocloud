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
  MainstreamDemocrat = 'mainstream-democrat',
  AlternativeLeft = 'alternative-left',
  Centrist = 'centrist',
  MainstreamRepublican = 'mainstream-republican',
  AlternativeRight = 'alternative-right',
  Unclear = 'unclear'
}

export enum NewsCategory {
  All = 'all',
  News = 'news',
  Politics = 'politics',
  Tech = 'tech',
  Science = 'science',
  Health = 'health',
  Culture = 'culture',
  Sports = 'sports',
  Entertainment = 'entertainment',
  Economy = 'economy',
  Environment = 'environment',
  Music = 'music',
  Law = 'law',
  Crime = 'crime',
  War = 'war',
  Media = 'media',
  AI = 'ai',
  Space = 'space',
  Fashion = 'fashion',
  Art = 'art'
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

export interface RssFeedConfig {
  url: string;
  name: string;
  category: NewsCategory;
  bias: PoliticalBias;
} 