import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import TagCloud3DContainer from './components/TagCloud3DOptimized';
import NewsDetail from './components/NewsDetail';
import TimeControls from './components/TimeControls';
import CategoryFilter from './components/CategoryFilter';
import RelatedNewsPanel from './components/RelatedNewsPanel';
import ResponsiveContainer from './components/ResponsiveContainer';
import { NewsCategory, NewsItem, TagCloudWord } from './types';
import { fetchNewsFromAPI } from './services/newsService';
import { getTimeSnapshot, createTimeSnapshot, initializeWithMockSnapshots, processNewsToWords } from './services/timeSnapshotService';
import { detectDeviceCapabilities } from './utils/performance';
import './App.css';

const App: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory>(NewsCategory.All);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [tagCloudWords, setTagCloudWords] = useState<TagCloudWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceCapabilities, setDeviceCapabilities] = useState(detectDeviceCapabilities());

  // Update device capabilities on window resize
  useEffect(() => {
    const handleResize = () => {
      setDeviceCapabilities(detectDeviceCapabilities());
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Fetch news data when category changes
  useEffect(() => {
    const loadNews = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // In live mode, fetch fresh data
        const news = await fetchNewsFromAPI(selectedCategory);
        if (news.length === 0) {
          setError('No news available for the selected category. Please try a different category.');
        }
        setNewsItems(news);
        
        // Process news items to generate tag cloud words
        const words = processNewsToWords(news);
        setTagCloudWords(words);
      } catch (error) {
        console.error('Error loading news:', error);
        setError('Failed to load news data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    loadNews();
    
    // Set up interval for real-time updates (every 5 minutes)
    const interval = setInterval(loadNews, 5 * 60 * 1000);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedCategory]);

  const handleCategoryChange = (category: NewsCategory) => {
    setSelectedCategory(category);
    setSelectedWord(null);
  };

  const handleWordSelect = (word: TagCloudWord) => {
    const wordText = word.text;
    if (selectedWord === wordText) {
      setSelectedWord(null);
      setRelatedNews([]);
    } else {
      setSelectedWord(wordText);
      // Find related news for this word
      const related = newsItems.filter(item => 
        word.newsIds.includes(item.id)
      );
      setRelatedNews(related);
    }
  };

  const handleCloseRelatedNews = () => {
    setSelectedWord(null);
    setRelatedNews([]);
  };

  // Simplified tag cloud for mobile devices
  const MobileTagCloud = () => (
    <div className="mobile-tag-cloud">
      <div className="mobile-status">
        <span className="live-indicator">Live</span>
      </div>
      
      <div className="mobile-words-container">
        {tagCloudWords.map((word, index) => (
          <button
            key={index}
            className={`mobile-word ${selectedWord === word.text ? 'selected' : ''}`}
            onClick={() => handleWordSelect(word)}
          >
            {word.text}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Router>
      <div className="app">
        <Header 
          selectedCategory={selectedCategory} 
          onCategoryChange={handleCategoryChange} 
        />
        <main className="main-content">
          <Routes>
            <Route path="/" element={
              <>
                <CategoryFilter 
                  selectedCategory={selectedCategory}
                  onCategoryChange={handleCategoryChange}
                />
                
                {error ? (
                  <div className="error-message">
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>Refresh</button>
                  </div>
                ) : (
                  <div className={`tag-cloud-wrapper ${loading ? 'loading' : ''}`}>
                    {loading && <div className="loading-overlay">Loading news data...</div>}
                    
                    <ResponsiveContainer
                      mobileComponent={<MobileTagCloud />}
                      desktopComponent={
                        <TagCloud3DContainer 
                          category={selectedCategory} 
                          words={tagCloudWords}
                          onWordSelect={handleWordSelect}
                          selectedWord={selectedWord}
                        />
                      }
                    />
                  </div>
                )}
              </>
            } />
            <Route path="/news/:newsId" element={<NewsDetail />} />
          </Routes>
        </main>
        <footer className="footer">
          <p>INFOCLOUD - Real-time News Tag Cloud</p>
          <p className="future-features">
            <span>Coming Soon:</span> Personalized Alerts | Geographic Overlay
          </p>
        </footer>
      </div>
    </Router>
  );
};

export default App;
