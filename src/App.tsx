import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import axios from 'axios';
import * as THREE from 'three'; // Import THREE for RefObject type
import Header from './components/Header';
import TagCloud3DOptimized from './components/TagCloud3DOptimized';
import FloatingNewsWindow from './components/FloatingNewsWindow'; // Import new component
import ResponsiveContainer from './components/ResponsiveContainer';
import { NewsCategory, NewsItem, TagCloudWord, PoliticalBias } from './types';
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
  const { 
    enabledBiases, 
    toggleBias,
    selectedCategory,
    setSelectedCategory
  } = useFilters();
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

  // Update the main news loading effect
  useEffect(() => {
    const loadNews = async () => {
      console.log(`Starting loadNews for category: ${selectedCategory}`);
      console.log('Enabled biases:', Array.from(enabledBiases));
      setLoading(true);
      setError(null);
      setNewsItems([]);
      setUnfilteredNewsItems([]);
      setAllTagCloudWords([]);

      // Construct parameters for the backend API call
      const params: Record<string, string> = {};

      // Pass category filter ('all' if null or specifically set)
      params.category = (selectedCategory && selectedCategory.toLowerCase() !== 'all') ? selectedCategory : 'all';

      // Pass bias filter as comma-separated string or 'all'
      const biasArray = Array.from(enabledBiases);
      const allBiasValues = Object.values(PoliticalBias); // Get all possible bias values
      if (biasArray.length === 0 || biasArray.length === allBiasValues.length) {
        params.bias = 'all'; // Send 'all' if none or all are selected
      } else {
        params.bias = biasArray.join(','); // Send comma-separated list
      }

      try {
        console.log('Fetching news from:', `${API_BASE_URL}/api/news`, 'with params:', params);
        const response = await axios.get(`${API_BASE_URL}/api/news`, { params });
        console.log('Received response:', response.data); // Keep this for debugging

        // Assuming the backend response structure is { data: NewsItem[], words: Word[] }
        const fetchedNews = response.data.data || [];
        const fetchedWords = response.data.words || [];

        setUnfilteredNewsItems(fetchedNews); // Store all fetched items (now balanced by backend)
        setAllTagCloudWords(fetchedWords); // Store words from backend

        // Set newsItems directly - backend handles bias distribution
        setNewsItems(fetchedNews);
        
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
  }, [selectedCategory, enabledBiases]);

  // Compute displayed words based on enabled biases AND selected category
  const displayedWords = useMemo(() => {
    console.log(`Filtering ${allTagCloudWords.length} total words by biases: [${Array.from(enabledBiases).join(', ')}] and category: ${selectedCategory}`);
    
    let filtered = allTagCloudWords;

    // 1. Filter by enabled biases
    if (enabledBiases.size < Object.values(PoliticalBias).length) { // Only filter if not all biases are enabled
        filtered = filtered.filter(word => enabledBiases.has(word.bias));
    }
    
    // 2. Filter by selected category (if not 'all')
    if (selectedCategory && selectedCategory.toLowerCase() !== 'all') {
        const upperCaseCategory = selectedCategory.toUpperCase(); // Match backend enum case
        filtered = filtered.filter(word => word.category === upperCaseCategory);
    }

    console.log(`Displaying ${filtered.length} words after filtering.`);
    return filtered;
    // Ensure selectedCategory is in dependency array
  }, [allTagCloudWords, enabledBiases, selectedCategory]);

  const handleWordSelect = async (word: TagCloudWord, clickPosition: { top: number; left: number }) => {
    if (!word || !word.text) {
      console.warn('handleWordSelect called with invalid word:', word);
      return;
    }
    // Prevent duplicate windows for the same word
    if (openNewsWindows.some(w => w.wordData.text === word.text)) {
      return;
    }
    
    console.log(`Finding related articles locally for: "${word.text}"`);
    setError(null); // Clear previous errors

    // Filter the existing unfiltered news items locally
    const relatedNews = unfilteredNewsItems.filter(item => 
      item.keywords && item.keywords.includes(word.text)
    );

    console.log(`Found ${relatedNews.length} related articles locally.`);

    if (relatedNews.length > 0) {
      setOpenNewsWindows(prev => [
        ...prev,
        // Ensure the structure matches the NewsWindow interface if it changed
        { wordData: word, newsItems: relatedNews, position: clickPosition }
      ]);
    } else {
      // This case should ideally not happen if words are derived correctly,
      // but handle it defensively.
      console.warn(`No related news found locally for tag "${word.text}", though tag was displayed.`);
      setError(`Internal inconsistency: No related news found for "${word.text}".`);
    }
    // No separate loading state needed as filtering is synchronous
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
          selectedCategory={selectedCategory} 
          onSelectCategory={setSelectedCategory}
          currentCategory={selectedCategory}
        />
        <div className="top-right-controls">
          <EditMenu onClose={() => {}} />
        </div>
        {/* Re-add the vertical category list on the right */}
        <ul className="category-list-vertical-right">
          {/* Add 'All' button */}
          <li>
            <button
              className={`category-button ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')} // Use context setter with 'all'
              style={{
                margin: '2px 0',
                width: '100%',
              }}
            >
              All
            </button>
          </li>
          {/* Existing category buttons */}
          {categories.map(category => (
            <li key={category}>
              <button
                className={`category-button ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)} // Use context setter
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
        {/* Wrapper for the main content area */}
        <div className="main-content-wrapper">
          <ResponsiveContainer
            mobileComponent={<MobileTagCloud />}
            desktopComponent={
              <div style={{ width: '100%', height: '100%' }}>
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
              </div>
            }
          />
          {openNewsWindows.map(win => (
            <FloatingNewsWindow
              key={win.wordData.text}
              data={{ wordData: win.wordData, newsItems: win.newsItems }}
              position={win.position}
              clickedWordBias={win.wordData.bias}
              onClose={() => handleCloseNewsWindow(win.wordData.text)}
              onMove={pos => handleMoveNewsWindow(win.wordData.text, pos)}
            />
          ))}
        </div> {/* End main content wrapper */}
      </div>
    </Router>
  );
};

// Wrap App with FilterProvider
const AppWithProviders: React.FC = () => (
  <FilterProvider>
    <App />
  </FilterProvider>
);

export default AppWithProviders;
