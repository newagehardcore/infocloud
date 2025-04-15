import React, { useEffect, useState, useRef } from 'react';
import { NewsCategory, TagCloudWord, NewsItem } from '../types';
import { fetchNewsFromAPI, extractKeywords } from '../services/newsService';
import './TagCloudContainer.css';

// This is a placeholder component that will be replaced with Three.js visualization
// in the next implementation step
const TagCloudContainer: React.FC<{
  category: NewsCategory;
  currentTime: Date;
  isTimeMachineMode: boolean;
}> = ({ category, currentTime, isTimeMachineMode }) => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [tagCloudWords, setTagCloudWords] = useState<TagCloudWord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fetch news data
  useEffect(() => {
    const loadNews = async () => {
      try {
        setLoading(true);
        const news = await fetchNewsFromAPI(category);
        setNewsItems(news);
        
        // Process news items to generate tag cloud words
        const words = await processNewsToWords(news);
        setTagCloudWords(words);
      } catch (error) {
        console.error('Error loading news:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadNews();
    
    // Set up interval for real-time updates (every 5 minutes)
    // Only in live mode, not in time machine mode
    let interval: NodeJS.Timeout;
    if (!isTimeMachineMode) {
      interval = setInterval(loadNews, 5 * 60 * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [category, isTimeMachineMode]);
  
  // Update related news when a word is selected
  useEffect(() => {
    if (selectedWord) {
      const related = newsItems.filter(item => 
        item.keywords.includes(selectedWord.toLowerCase())
      );
      setRelatedNews(related);
    } else {
      setRelatedNews([]);
    }
  }, [selectedWord, newsItems]);
  
  // Process news items to generate tag cloud words
  const processNewsToWords = async (news: NewsItem[]): Promise<TagCloudWord[]> => {
    const wordMap = new Map<string, TagCloudWord>();
    
    // Process each news item sequentially
    for (const item of news) {
      // For each news item, extract or use existing keywords
      let keywords: string[];
      
      if (item.keywords.length > 0) {
        keywords = item.keywords;
      } else {
        keywords = await extractKeywords(item);
      }
      
      // Process the keywords
      for (const word of keywords) {
        const normalizedWord = word.toLowerCase();
        
        if (wordMap.has(normalizedWord)) {
          // Update existing word
          const existingWord = wordMap.get(normalizedWord)!;
          existingWord.value += 1;
          existingWord.newsIds.push(item.id);
          // We keep the first bias we encounter for simplicity
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
  
  const handleWordClick = (word: string) => {
    setSelectedWord(word === selectedWord ? null : word);
  };
  
  // Get color based on political bias
  const getBiasColor = (bias: string): string => {
    switch (bias) {
      case 'mainstream-left': return '#6495ED'; // Light blue
      case 'alternative-left': return '#00008B'; // Dark blue
      case 'centrist': return '#800080'; // Purple
      case 'mainstream-right': return '#FFB6C1'; // Light red
      case 'alternative-right': return '#FF0000'; // Bright red
      default: return '#808080'; // Gray for unclear
    }
  };
  
  // Calculate font size based on word frequency
  const getFontSize = (value: number): number => {
    const minSize = 4;   // Extremely small minimum size
    const maxSize = 80;  // Larger maximum for dramatic effect
    const maxValue = Math.max(...tagCloudWords.map(w => w.value));
    
    // Use a quartic power scale for the most extreme size differences
    const normalizedValue = value / maxValue;
    
    // Apply power of 4 for extremely dramatic difference
    return minSize + (Math.pow(normalizedValue, 4) * (maxSize - minSize));
  };
  
  if (loading && newsItems.length === 0) {
    return <div className="tag-cloud-container loading">Loading news data...</div>;
  }
  
  return (
    <div ref={containerRef} className="tag-cloud-container">
      {loading ? (
        <div className="loading-state">Loading news data...</div>
      ) : newsItems.length === 0 ? (
        <div className="empty-state">
          <h2>No News Available</h2>
          <p>There are currently no news articles available for this category. Please try again later or select a different category.</p>
        </div>
      ) : (
        <div className="status-indicator">
          {isTimeMachineMode ? (
            <span className="historical-indicator">
              Viewing historical data: {currentTime.toLocaleString()}
            </span>
          ) : (
            <span className="live-indicator">Live Updates</span>
          )}
        </div>
      )}
      
      {/* Placeholder for Three.js visualization */}
      <div className="tag-cloud-placeholder">
        <div className="tag-cloud-words">
          {tagCloudWords.map((word, index) => (
            <span
              key={index}
              className={`tag-cloud-word ${selectedWord === word.text ? 'selected' : ''}`}
              style={{
                fontSize: `${getFontSize(word.value)}px`,
                color: getBiasColor(word.bias),
                cursor: 'pointer'
              }}
              onClick={() => handleWordClick(word.text)}
            >
              {word.text}
            </span>
          ))}
        </div>
      </div>
      
      {/* Related news panel */}
      {selectedWord && (
        <div className="related-news-panel">
          <h3>News related to "{selectedWord}"</h3>
          {relatedNews.length > 0 ? (
            <ul className="related-news-list">
              {relatedNews.map(item => (
                <li key={item.id} className="related-news-item">
                  <a href={`/news/${item.id}`} className="news-link">
                    <h4>{item.title}</h4>
                    <div className="news-source">
                      <span className="source-name">{item.source.name}</span>
                      <span 
                        className="source-bias"
                        style={{ backgroundColor: getBiasColor(item.source.bias) }}
                      ></span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>No related news found.</p>
          )}
          <button 
            className="close-panel-button"
            onClick={() => setSelectedWord(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default TagCloudContainer;
