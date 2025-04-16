import { TimeSnapshot, NewsItem, TagCloudWord, NewsCategory } from '../types';
import { fetchAllNewsItems } from './newsService';

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
      } else {
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
  
  return Array.from(wordMap.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 100); 
};

// Function to create a time snapshot
export const createTimeSnapshot = async (category: NewsCategory = NewsCategory.All): Promise<TimeSnapshot> => {
  const timestamp = new Date().toISOString();
  const newsItems = await fetchAllNewsItems(category); 
  // Use the local processNewsToWords function
  const words = await processNewsToWords(newsItems); 
  
  const snapshot: TimeSnapshot = {
    timestamp,
    words,
    newsItems
  };
  
  // Reverted to using local Map for storage
  timeSnapshots.set(timestamp, snapshot);
  
  // Limit the number of snapshots
  const maxSnapshots = 48; 
  if (timeSnapshots.size > maxSnapshots) {
    const oldestKey = Array.from(timeSnapshots.keys()).sort()[0];
    timeSnapshots.delete(oldestKey);
  }
  
  return snapshot;
};

// Function to get a time snapshot closest to the specified time (reverted logic)
export const getTimeSnapshot = async (time: Date): Promise<TimeSnapshot | null> => {
  console.log('Getting snapshot, total snapshots available:', timeSnapshots.size);
  if (timeSnapshots.size === 0) {
    console.log('No snapshots available');
    return null;
  }
  
  const targetTime = time.toISOString();
  console.log('Target time:', targetTime);
  
  const timestamps = Array.from(timeSnapshots.keys()).sort();
  console.log('Available timestamps:', timestamps);
  
  // Find the closest timestamp (binary search would be more efficient)
  let closestTimestamp = timestamps[0];
  let minDiff = Math.abs(new Date(targetTime).getTime() - new Date(closestTimestamp).getTime());
  
  for (const timestamp of timestamps) {
    const diff = Math.abs(new Date(targetTime).getTime() - new Date(timestamp).getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closestTimestamp = timestamp;
    }
    // Optimization: if diff starts increasing, we passed the closest
    else if (new Date(timestamp).getTime() > new Date(targetTime).getTime()) { 
      break;
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
