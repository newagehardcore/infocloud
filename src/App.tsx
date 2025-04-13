import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import TagCloud3DOptimized from './components/TagCloud3DOptimized';
import NewsDetail from './components/NewsDetail';
import TimeControls from './components/TimeControls';
import RelatedNewsPanel from './components/RelatedNewsPanel';
import ResponsiveContainer from './components/ResponsiveContainer';
import ApiDebugPanel, { API_SOURCE_CHANGE_EVENT } from './components/ApiDebugPanel';
import { NewsCategory, NewsItem, TagCloudWord } from './types';
import { fetchNewsFromAPI } from './services/newsService';
import { getTimeSnapshot, createTimeSnapshot } from './services/timeSnapshotService';
import { processNewsToWords, DEFAULT_WORD_PROCESSING_CONFIG, analyzeWordDistribution } from './utils/wordProcessing';
import { detectDeviceCapabilities } from './utils/performance';
import { preloadFonts } from './utils/fonts';
import './App.css';
import './components/TagFonts.css';

// Flag to show the debug panel - true for development, false for production
const SHOW_DEBUG_PANEL = process.env.NODE_ENV === 'development' || true; // Set to true to always show it during testing

const App: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory>(NewsCategory.All);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [tagCloudWords, setTagCloudWords] = useState<TagCloudWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceCapabilities, setDeviceCapabilities] = useState(detectDeviceCapabilities());
  // Add a trigger for refreshing data when API sources change
  const [apiSourceChangeCount, setApiSourceChangeCount] = useState(0);

  // Preload fonts on app initialization
  useEffect(() => {
    preloadFonts();
  }, []);

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

  // Listen for API source change events
  useEffect(() => {
    const handleApiSourceChange = () => {
      // Increment counter to trigger a refresh
      setApiSourceChangeCount(prev => prev + 1);
    };
    
    window.addEventListener(API_SOURCE_CHANGE_EVENT, handleApiSourceChange);
    
    return () => {
      window.removeEventListener(API_SOURCE_CHANGE_EVENT, handleApiSourceChange);
    };
  }, []);

  // Fetch news data when category changes or API sources change
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
        
        // Process news items to generate tag cloud words with refined filtering
        const words = await processNewsToWords(news, {
          ...DEFAULT_WORD_PROCESSING_CONFIG,
          minFrequency: 1, // Allow words that appear only once
          maxWords: 500, // Increase maximum words significantly
          minWordLength: 2, // Allow shorter words
          removeStopWords: true, // Keep filtering stop words
          combineWordForms: false // Don't combine word forms to preserve more variety
        });

        // Log word distribution analysis in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Word distribution analysis:', analyzeWordDistribution(words));
        }

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
  }, [selectedCategory, apiSourceChangeCount]);

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
                        <TagCloud3DOptimized 
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
        
        {/* API Debug Panel */}
        <ApiDebugPanel visible={SHOW_DEBUG_PANEL} />
      </div>
    </Router>
  );
};

export default App;
