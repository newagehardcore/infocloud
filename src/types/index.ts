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
  World = 'world',
  US = 'us',
  Politics = 'politics',
  Tech = 'tech',
  Finance = 'finance',
  Entertainment = 'entertainment',
  Sports = 'sports',
  Health = 'health',
  Science = 'science',
  Education = 'education'
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
