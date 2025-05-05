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

export enum NewsCategory {
  News = 'News',
  Politics = 'Politics',
  Tech = 'Tech',
  Science = 'Science',
  Health = 'Health',
  Sports = 'Sports',
  Entertainment = 'Entertainment',
  Economics = 'Economics',
  Environment = 'Environment',
  Music = 'Music',
  Law = 'Law',
  AI = 'AI',
  Space = 'Space',
  Fashion = 'Fashion',
  Arts = 'Arts'
}

export interface TagCloudWord {
  text: string;
  value: number; // frequency/importance
  bias: PoliticalBias;
  newsIds: string[]; // IDs of news items containing this word
  category: NewsCategory;
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
