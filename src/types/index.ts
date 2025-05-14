export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: {
    name: string;
    bias: PoliticalBias;
    type: SourceType;
  };
  publishedAt: string;
  category: NewsCategory;
  keywords: string[];
  bias: PoliticalBias;
  createdAt?: string;
}

export enum PoliticalBias {
  Left = 'Left',
  Liberal = 'Liberal',
  Centrist = 'Centrist',
  Unknown = 'Unknown',
  Conservative = 'Conservative',
  Right = 'Right'
}

export enum SourceType {
  Independent = 'INDEPENDENT',
  Corporate = 'CORPORATE',
  State = 'STATE',
  Unknown = 'UNKNOWN'
}

export enum NewsCategory {
  NEWS = 'NEWS',
  POLITICS = 'POLITICS',
  WORLD = 'WORLD',
  US = 'US',
  TECH = 'TECH',
  SCIENCE = 'SCIENCE',
  HEALTH = 'HEALTH',
  SPORTS = 'SPORTS',
  ENTERTAINMENT = 'ENTERTAINMENT',
  ECONOMICS = 'ECONOMICS',
  ENVIRONMENT = 'ENVIRONMENT',
  MUSIC = 'MUSIC',
  LAW = 'LAW',
  AI = 'AI',
  SPACE = 'SPACE',
  FASHION = 'FASHION',
  ARTS = 'ARTS'
}

export interface TagCloudWord {
  text: string;
  value: number; // frequency/importance
  biases: PoliticalBias[];
  types: SourceType[];
  newsIds: string[]; // IDs of news items containing this word
  categories: NewsCategory[];
  variants?: Set<string>; // Optional set of variant forms of this word
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
