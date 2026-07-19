import { TimeSnapshot, NewsItem, TagCloudWord, NewsCategory } from '../types';
// import { fetchAllNewsItems } from './newsService'; // Removed import

// In-memory storage for time snapshots
const timeSnapshots: Map<string, TimeSnapshot> = new Map();

// Function to process news items locally (kept from original file structure)
const processNewsToWords = async (news: NewsItem[]): Promise<TagCloudWord[]> => {
  const wordMap = new Map<string, TagCloudWord>();
  
  for (const item of news) {
    // Use keywords directly from the news item
    for (const word of item.keywords || []) { // Added check for keywords existence
      const normalizedWord = word.toLowerCase();
      
      if (wordMap.has(normalizedWord)) {
        const existingWord = wordMap.get(normalizedWord)!;
        existingWord.value += 1;
        if (!existingWord.newsIds.includes(item.id)) {
          existingWord.newsIds.push(item.id);
        }
        // Also ensure the category is added to the existing word's categories array
        if (item.category && !existingWord.categories.includes(item.category)) {
          existingWord.categories.push(item.category);
        }
        // Add source type to the existing word's types array if not already included
        if (item.source.type && !existingWord.types.includes(item.source.type)) {
          existingWord.types.push(item.source.type);
        }
      } else {
        wordMap.set(normalizedWord, {
          text: normalizedWord,
          value: 1,
          biases: [item.source.bias],
          types: [item.source.type || 'UNKNOWN'], // Add types property with source type, default to 'UNKNOWN'
          newsIds: [item.id],
          categories: [item.category] // Changed to 'categories' and wrapped in an array
        });
      }
    }
  }
  
  return Array.from(wordMap.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 100); 
};

// Function to create a new time snapshot (requires newsItems and words as input now)
export const createTimeSnapshot = (newsItems: NewsItem[], words: TagCloudWord[]): string => {
  const timestamp = new Date().toISOString();
  const snapshot: TimeSnapshot = {
    timestamp,
    newsItems,
    words
  };
  timeSnapshots.set(timestamp, snapshot);
  return timestamp;
};

// Function to get a specific time snapshot by timestamp
export const getTimeSnapshot = (timestamp: string): TimeSnapshot | undefined => {
  return timeSnapshots.get(timestamp);
};

// Function to get all available snapshot timestamps
export const getAllSnapshotTimestamps = (): string[] => {
  return Array.from(timeSnapshots.keys()).sort((a, b) => b.localeCompare(a)); // Sort newest first
};

// Function to delete a time snapshot
export const deleteTimeSnapshot = (timestamp: string): boolean => {
  return timeSnapshots.delete(timestamp);
};

// Old function - commented out as fetchAllNewsItems is removed
/*
export const createTimeSnapshotFromCurrent = async (): Promise<string> => {
  const timestamp = new Date().toISOString();
  try {
    const currentNewsItems = await fetchAllNewsItems(); 
    // Assuming word processing happens elsewhere or is passed in
    // const currentWords = processNewsToWords(currentNewsItems); 
    const snapshot: TimeSnapshot = {
      timestamp,
      newsItems: currentNewsItems,
      words: [] // Placeholder for words
    };
    timeSnapshots.set(timestamp, snapshot);
    return timestamp;
  } catch (error) {
    console.error("Failed to create time snapshot from current data:", error);
    throw error; // Re-throw error
  }
};
*/
