import { TimeSnapshot, NewsItem, TagCloudWord, NewsCategory } from '../types';
import { fetchNewsFromAPI } from './newsService';

// In-memory storage for time snapshots
// In a real application, this would be stored in a database
const timeSnapshots: Map<string, TimeSnapshot> = new Map();

// Function to create a time snapshot
export const createTimeSnapshot = async (category: NewsCategory = NewsCategory.All): Promise<TimeSnapshot> => {
  const timestamp = new Date().toISOString();
  const newsItems = await fetchNewsFromAPI(category);
  const words = await processNewsToWords(newsItems);
  
  const snapshot: TimeSnapshot = {
    timestamp,
    words,
    newsItems
  };
  
  // Store the snapshot
  timeSnapshots.set(timestamp, snapshot);
  
  // Limit the number of snapshots to keep memory usage reasonable
  // In a real application, this would be handled by a database with proper retention policies
  const maxSnapshots = 48; // Keep 48 snapshots (e.g., one per hour for 2 days)
  if (timeSnapshots.size > maxSnapshots) {
    const oldestKey = Array.from(timeSnapshots.keys()).sort()[0];
    timeSnapshots.delete(oldestKey);
  }
  
  return snapshot;
};

// Function to get a time snapshot closest to the specified time
export const getTimeSnapshot = async (time: Date): Promise<TimeSnapshot | null> => {
  console.log('Getting snapshot, total snapshots available:', timeSnapshots.size);
  if (timeSnapshots.size === 0) {
    console.log('No snapshots available');
    return null;
  }
  
  const targetTime = time.toISOString();
  console.log('Target time:', targetTime);
  
  // Get all timestamps and sort them
  const timestamps = Array.from(timeSnapshots.keys()).sort();
  console.log('Available timestamps:', timestamps);
  
  // Find the closest timestamp
  let closestTimestamp = timestamps[0];
  let minDiff = Math.abs(new Date(targetTime).getTime() - new Date(closestTimestamp).getTime());
  
  for (const timestamp of timestamps) {
    const diff = Math.abs(new Date(targetTime).getTime() - new Date(timestamp).getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closestTimestamp = timestamp;
    }
  }
  
  const snapshot = timeSnapshots.get(closestTimestamp);
  console.log('Found closest snapshot:', snapshot ? `${snapshot.timestamp} with ${snapshot.newsItems.length} news items` : 'none');
  
  return snapshot || null;
};

// Function to get all available snapshot times
export const getAvailableSnapshotTimes = (): Date[] => {
  return Array.from(timeSnapshots.keys()).map(timestamp => new Date(timestamp)).sort((a, b) => b.getTime() - a.getTime());
};

// Function to process news items to generate tag cloud words
export const processNewsToWords = async (news: NewsItem[]): Promise<TagCloudWord[]> => {
  const wordMap = new Map<string, TagCloudWord>();
  
  for (const item of news) {
    // For each news item, use its keywords
    for (const word of item.keywords) {
      const normalizedWord = word.toLowerCase();
      
      if (wordMap.has(normalizedWord)) {
        // Update existing word
        const existingWord = wordMap.get(normalizedWord)!;
        existingWord.value += 1;
        if (!existingWord.newsIds.includes(item.id)) {
          existingWord.newsIds.push(item.id);
        }
      } else {
        // Create new word
        wordMap.set(normalizedWord, {
          text: normalizedWord,
          value: 1,
          bias: item.source.bias,
          newsIds: [item.id],
          category: item.category
        });
      }
    }
  }
  
  // Convert map to array and sort by value (frequency)
  return Array.from(wordMap.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 100); // Limit to top 100 words for performance
};

export default {
  createTimeSnapshot,
  getTimeSnapshot,
  getAvailableSnapshotTimes,
  processNewsToWords
};
