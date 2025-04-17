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
  createdAt?: string;
}

export enum PoliticalBias {
  AlternativeLeft = 'Alternative Left',
  MainstreamDemocrat = 'Mainstream Democrat',
  Centrist = 'Centrist',
  Unclear = 'Unclear',
  MainstreamRepublican = 'Mainstream Republican',
  AlternativeRight = 'Alternative Right'
}

export enum NewsCategory {
  All = 'All',
  News = 'News',
  Politics = 'Politics',
  Tech = 'Tech',
  Science = 'Science',
  Health = 'Health',
  Culture = 'Culture',
  Sports = 'Sports',
  Entertainment = 'Entertainment',
  Economy = 'Economy',
  Environment = 'Environment',
  Music = 'Music',
  Law = 'Law',
  Crime = 'Crime',
  War = 'War',
  Media = 'Media',
  AI = 'AI',
  Space = 'Space',
  Fashion = 'Fashion',
  Art = 'Art'
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
