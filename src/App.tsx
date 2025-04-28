import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import axios from 'axios';
import * as THREE from 'three'; // Import THREE for RefObject type
import Header from './components/Header';
import TagCloud3DOptimized from './components/TagCloud3DOptimized';
import FloatingNewsWindow from './components/FloatingNewsWindow'; // Import new component
import ResponsiveContainer from './components/ResponsiveContainer';
import { NewsCategory, NewsItem, TagCloudWord, PoliticalBias } from './types';
import { processNewsToWords, DEFAULT_WORD_PROCESSING_CONFIG } from './utils/wordProcessing';
import { preloadFonts } from './utils/fonts';
import { FilterProvider, useFilters, BIAS_UPDATE_EVENT } from './contexts/FilterContext';
import LoadingBar from './components/LoadingBar';
import './App.css';
import './components/TagFonts.css';
import TimeControls from './components/TimeControls';
import EditMenu from './components/EditMenu';

// Flag to show the debug panel - true for development, false for production
const SHOW_DEBUG_PANEL = process.env.NODE_ENV === 'development' || true; // Set to true to always show it during testing

// Define Backend API Base URL (consider moving to .env)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

// Helper function to filter news items by bias
const filterNewsByBias = (items: NewsItem[], enabledBiases: Set<PoliticalBias>) => {
  if (enabledBiases.size === 0) {
    console.log('No biases enabled, returning empty array');
    return []; // No biases enabled, return empty array
  }
  
  console.log(`Filtering ${items.length} news items by biases:`, Array.from(enabledBiases));
  
  const filteredItems = items.filter(item => {
    // Get the bias value from the news item
    const itemBias = item.source.bias;
    // Check if this bias is in the enabled set
    return enabledBiases.has(itemBias);
  });
  
  console.log(`After filtering: ${filteredItems.length} items remain`);
  return filteredItems;
};

// Helper to filter news items to last 24 hours
const filterLast24Hours = (items: NewsItem[]) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return items.filter(item => {
    const published = new Date(item.publishedAt);
    return published > cutoff && published <= now;
  });
};

interface WordData {
  text: string;
  value: number;
  bias: PoliticalBias;
}

interface BiasUpdateDetail {
  bias: PoliticalBias;
  enabled: boolean;
}

interface NewsWindow {
  wordData: TagCloudWord;
  newsItems: NewsItem[];
  position: { top: number; left: number };
}

const App: React.FC = () => {
  const { enabledBiases, toggleBias } = useFilters();
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory>(NewsCategory.News);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [unfilteredNewsItems, setUnfilteredNewsItems] = useState<NewsItem[]>([]);
  const [allTagCloudWords, setAllTagCloudWords] = useState<TagCloudWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [openNewsWindows, setOpenNewsWindows] = useState<NewsWindow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoadingBar, setShowLoadingBar] = useState(false);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [words, setWords] = useState<WordData[]>([]);
  const [wordsByBias, setWordsByBias] = useState<Record<PoliticalBias, WordData[]>>({
    [PoliticalBias.Left]: [],
    [PoliticalBias.Liberal]: [],
    [PoliticalBias.Centrist]: [],
    [PoliticalBias.Unknown]: [],
    [PoliticalBias.Conservative]: [],
    [PoliticalBias.Right]: []
  });

  // Add state for 24-hour filter
  const [use24HourFilter, setUse24HourFilter] = useState(() => {
    const saved = localStorage.getItem('show_24hour_filter');
    return saved ? saved === 'true' : false;
  });

  // Preload fonts on app initialization
  useEffect(() => {
    preloadFonts();
  }, []);

  // Effect to handle time filter changes
  useEffect(() => {
    const handleTimeFilterChange = (event: CustomEvent) => {
      const { enabled } = event.detail;
      setUse24HourFilter(enabled);
      
      // Re-filter current items based on new time filter setting
      const biasFiltered = filterNewsByBias(unfilteredNewsItems, enabledBiases);
      const timeFiltered = enabled ? filterLast24Hours(biasFiltered) : biasFiltered;
      setNewsItems(timeFiltered);
    };

    window.addEventListener('time_filter_change', handleTimeFilterChange as EventListener);
    return () => {
      window.removeEventListener('time_filter_change', handleTimeFilterChange as EventListener);
    };
  }, [unfilteredNewsItems, enabledBiases]);

  // Update the bias update effect to respect time filter
  useEffect(() => {
    const handleBiasUpdate = () => {
      const savedBiases = localStorage.getItem('enabled_biases');
      const currentEnabledBiases = savedBiases ?
        new Set(JSON.parse(savedBiases) as PoliticalBias[]) :
        new Set(Object.values(PoliticalBias));

      const biasFilteredNews = filterNewsByBias(unfilteredNewsItems, currentEnabledBiases);
      // Apply time filter if enabled
      const timeFiltered = use24HourFilter ? filterLast24Hours(biasFilteredNews) : biasFilteredNews;
      setNewsItems(timeFiltered);
    };

    window.addEventListener(BIAS_UPDATE_EVENT, handleBiasUpdate);
    return () => {
      window.removeEventListener(BIAS_UPDATE_EVENT, handleBiasUpdate);
    };
  }, [unfilteredNewsItems, use24HourFilter]);

  // Update the main news loading effect to respect time filter
  useEffect(() => {
    const loadNews = async () => {
      console.log(`Starting loadNews for category: ${selectedCategory}`);
      setLoading(true);
      setError(null);
      setNewsItems([]);
      setUnfilteredNewsItems([]);
      setAllTagCloudWords([]);

      const params: Record<string, any> = {
        limit: 1000,
        category: selectedCategory,
      };

      try {
        const response = await axios.get(`${API_BASE_URL}/api/news`, { params });

        if (response.data && response.data.data) {
          setUnfilteredNewsItems(response.data.data);
          const biasFiltered = filterNewsByBias(response.data.data, enabledBiases);
          const timeFiltered = use24HourFilter ? filterLast24Hours(biasFiltered) : biasFiltered;
          setNewsItems(timeFiltered);
        } else {
          setNewsItems([]);
          setUnfilteredNewsItems([]);
        }
      } catch (err: any) {
        console.error('Error fetching news from backend:', err);
        setError(`Failed to load news data: ${err.message}`);
        setNewsItems([]);
        setUnfilteredNewsItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadNews();
  }, [selectedCategory, enabledBiases, use24HourFilter]);

  // Effect for processing words - now depends on unfilteredNewsItems
  useEffect(() => {
    if (unfilteredNewsItems.length > 0 && !loading) {
      const processWords = async () => {
        console.log(`Processing words for ${unfilteredNewsItems.length} unfiltered news items`);
        // Process words with balanced bias distribution
        const words = await processNewsToWords(unfilteredNewsItems, {
          ...DEFAULT_WORD_PROCESSING_CONFIG,
          minFrequency: 1, // Show words that appear at least once
          maxWords: 500, // Show more words
          minWordLength: 3, // Keep minimum word length
          removeStopWords: true,
          combineWordForms: true // Enable root finding
        });
        
        // Log bias distribution for debugging
        const biasDistribution = words.reduce((acc, word) => {
          acc[word.bias] = (acc[word.bias] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log('Tag cloud bias distribution:', biasDistribution);
        
        setAllTagCloudWords(words);
        console.log(`Generated ${words.length} tag cloud words with balanced bias distribution.`);
      };
      processWords();
    } else if (unfilteredNewsItems.length === 0 && !loading) {
      setAllTagCloudWords([]);
    }
  }, [unfilteredNewsItems, loading]);

  // Compute displayed words based on enabled biases (fast, in-memory)
  const displayedWords = allTagCloudWords.filter(word => enabledBiases.has(word.bias));

  const handleCategoryChange = (category: NewsCategory) => {
    console.log("Category changed to:", category);
    setSelectedCategory(category);
    setSelectedWord(null);
    setOpenNewsWindows([]);
  };

  const handleWordSelect = async (word: TagCloudWord, clickPosition: { top: number; left: number }) => {
    if (!word || !word.text) {
      console.warn('handleWordSelect called with invalid word:', word);
      return;
    }
    // Prevent duplicate windows for the same word
    if (openNewsWindows.some(w => w.wordData.text === word.text)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<NewsItem[]>(`${API_BASE_URL}/api/news/related`, {
        params: { keyword: word.text },
        timeout: 15000
      });
      if (response.data && response.data.length > 0) {
        setOpenNewsWindows(prev => [
          ...prev,
          { wordData: word, newsItems: response.data, position: clickPosition }
        ]);
      } else {
        setError(`No related news found for "${word.text}".`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch related news');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseNewsWindow = (wordText: string) => {
    setOpenNewsWindows(prev => prev.filter(w => w.wordData.text !== wordText));
  };

  // Update a window's position by word text
  const handleMoveNewsWindow = (wordText: string, newPosition: { top: number; left: number }) => {
    setOpenNewsWindows(prev => prev.map(w =>
      w.wordData.text === wordText ? { ...w, position: newPosition } : w
    ));
  };

  // Simplified tag cloud for mobile devices
  const MobileTagCloud = () => (
    <div className="mobile-message">Tag cloud rendering optimized for desktop.</div>
  );

  // Helper to start the loading bar
  const startLoadingBar = () => {
    setShowLoadingBar(true);
    setLoadingProgress(10);
    if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    loadingIntervalRef.current = setInterval(() => {
      setLoadingProgress(prev => (prev < 90 ? prev + 0.5 + Math.random() : prev));
    }, 30);
  };
  // Helper to finish the loading bar
  const finishLoadingBar = () => {
    if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    setLoadingProgress(100);
    setTimeout(() => setShowLoadingBar(false), 400);
    setTimeout(() => setLoadingProgress(0), 800);
  };

  // Start loading bar when news loads
  useEffect(() => {
    if (loading) {
      startLoadingBar();
    }
  }, [loading]);

  // Start loading bar when processing words
  useEffect(() => {
    if (unfilteredNewsItems.length > 0 && !loading) {
      startLoadingBar();
    }
  }, [unfilteredNewsItems, loading]);

  // Finish loading bar when words are ready
  useEffect(() => {
    if (allTagCloudWords.length > 0 && !loading) {
      finishLoadingBar();
    }
  }, [allTagCloudWords, loading]);

  const categories = Object.values(NewsCategory);

  return (
    <Router>
      <div className="app">
        <LoadingBar progress={loadingProgress} visible={showLoadingBar} />
        <Header 
          onSelectCategory={handleCategoryChange} 
          currentCategory={selectedCategory} 
          selectedCategory={selectedCategory} 
        />
        {/* Top right controls: clock and edit menu */}
        <div className="top-right-controls">
          <EditMenu onClose={() => {}} />
        </div>
        {/* Right-side vertical category list */}
        <ul className="category-list-vertical-right">
          {categories.map(category => (
            <li key={category}>
              <button
                className={`category-button ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category)}
                style={{
                  margin: '2px 0',
                  width: '100%',
                }}
              >
                {category}
              </button>
            </li>
          ))}
        </ul>
        <main className={`main-content ${selectedWord ? 'detail-visible' : ''}`}>
          <ResponsiveContainer
            mobileComponent={<MobileTagCloud />}
            desktopComponent={
              <>
                {loading && <div className="loading-indicator">Loading News...</div>}
                {error && <div className="error-message">Error: {error}</div>}
                {!loading && displayedWords.length === 0 && !error && (
                  <div className="loading-indicator">No articles found or sources returned empty. Check API keys and source settings.</div>
                )}
                <TagCloud3DOptimized 
                  category={selectedCategory}
                  words={displayedWords}
                  onWordSelect={handleWordSelect}
                  selectedWord={selectedWord}
                />
              </>
            }
          />
          {openNewsWindows.map(win => (
            <FloatingNewsWindow
              key={win.wordData.text}
              data={win}
              position={win.position}
              clickedWordBias={win.wordData.bias}
              onClose={() => handleCloseNewsWindow(win.wordData.text)}
              onMove={pos => handleMoveNewsWindow(win.wordData.text, pos)}
            />
          ))}
        </main>
      </div>
    </Router>
  );
};

// New root component that provides the context
const AppWithProviders: React.FC = () => {
  return (
    <FilterProvider>
      <App />
    </FilterProvider>
  );
};

export default AppWithProviders;
