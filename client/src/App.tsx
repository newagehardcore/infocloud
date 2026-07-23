import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import axios from 'axios';
import * as THREE from 'three'; // Import THREE for RefObject type
import Header from './components/Header';
import TagCloud3DOptimized from './components/TagCloud3DOptimized';
import FloatingNewsWindow from './components/FloatingNewsWindow'; // Import new component
import ResponsiveContainer from './components/ResponsiveContainer';
import { NewsCategory, NewsItem, TagCloudWord, PoliticalBias, SourceType } from './types';
import { preloadFonts } from './utils/fonts';
import { getDominantSourceType, getDominantBias } from './utils/dominance';
import { FilterProvider, useFilters, BIAS_UPDATE_EVENT, TYPE_UPDATE_EVENT } from './contexts/FilterContext';
import LoadingBar from './components/LoadingBar';
import './App.css';
import './components/TagFonts.css';
import TimeControls from './components/TimeControls';

// Flag to show the debug panel - true for development, false for production
const SHOW_DEBUG_PANEL = process.env.NODE_ENV === 'development' || true; // Set to true to always show it during testing

// Define Backend API Base URL - use relative URL to avoid hostname resolution issues
// Same-origin '/api' in dev (CRA proxy → localhost:5001). For static hosting
// (GitHub Pages), set REACT_APP_API_URL to the public backend origin at build time.
const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL.replace(/\/$/, '')}/api`
  : '/api';

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
// Helper to filter news items to last 24 hours OR Since Midnight
const filterByTime = (items: NewsItem[], strictToday: boolean = true) => {
  const now = new Date();
  let cutoff: Date;

  if (strictToday) {
    // Midnight today
    cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
  } else {
    // Rolling 24h
    cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  return items.filter(item => {
    const published = new Date(item.publishedAt);
    return published >= cutoff; // Include future items if any, but backend filters them usually.
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
    setSelectedCategory,
    enabledTypes,
    toggleType
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
  // Add state for 24-hour filter
  const [use24HourFilter, setUse24HourFilter] = useState(() => {
    const saved = localStorage.getItem('show_24hour_filter');
    return saved ? saved === 'true' : true; // Default to true if not saved
  });

  // Add state for "Strict Today" (Calendar Day) filter
  const [useCalendarDayFilter, setUseCalendarDayFilter] = useState<boolean>(true); // Default to true for "Today"

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
      const timeFiltered = enabled ? filterByTime(biasFiltered, useCalendarDayFilter) : biasFiltered;
      setNewsItems(timeFiltered);
    };

    window.addEventListener('time_filter_change', handleTimeFilterChange as EventListener);
    return () => {
      window.removeEventListener('time_filter_change', handleTimeFilterChange as EventListener);
    };
  }, [unfilteredNewsItems, enabledBiases, useCalendarDayFilter]);

  // Update the bias update effect to respect time filter
  useEffect(() => {
    const handleBiasUpdate = () => {
      const savedBiases = localStorage.getItem('enabled_biases');
      const currentEnabledBiases = savedBiases ?
        new Set(JSON.parse(savedBiases) as PoliticalBias[]) :
        new Set(Object.values(PoliticalBias));

      const biasFilteredNews = filterNewsByBias(unfilteredNewsItems, currentEnabledBiases);
      // Apply time filter if enabled
      const timeFiltered = use24HourFilter ? filterByTime(biasFilteredNews, useCalendarDayFilter) : biasFilteredNews;
      setNewsItems(timeFiltered);
    };

    window.addEventListener(BIAS_UPDATE_EVENT, handleBiasUpdate);
    return () => {
      window.removeEventListener(BIAS_UPDATE_EVENT, handleBiasUpdate);
    };
  }, [unfilteredNewsItems, use24HourFilter, useCalendarDayFilter]);

  // Add effect to handle source type updates
  useEffect(() => {
    const handleTypeUpdate = () => {
      // Re-filter the displayed words with current filters
      // This will trigger a re-render of the tag cloud
      // The actual filtering happens in the displayedWords useMemo
    };

    window.addEventListener(TYPE_UPDATE_EVENT, handleTypeUpdate);
    return () => {
      window.removeEventListener(TYPE_UPDATE_EVENT, handleTypeUpdate);
    };
  }, []);

  // Update the main news loading effect
  useEffect(() => {
    const loadNews = async (isBackgroundRefresh = false) => {
      console.log(`Starting loadNews for category: ${selectedCategory}${isBackgroundRefresh ? ' (background refresh)' : ''}`);
      console.log('Enabled biases:', Array.from(enabledBiases));
      if (!isBackgroundRefresh) {
        // Only blank the view on user-driven loads; background refreshes
        // swap the data in place so the cloud updates without flashing
        setLoading(true);
        setError(null);
        setNewsItems([]);
        setUnfilteredNewsItems([]);
        setAllTagCloudWords([]);
      }

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
        console.log('Fetching news from:', `${API_BASE_URL}/news`, 'with params:', params);
        const response = await axios.get(`${API_BASE_URL}/news`, { params });
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
        if (!isBackgroundRefresh) {
          // A failed background refresh keeps showing the current data
          setError(`Failed to load news data: ${err.message}`);
          setNewsItems([]);
          setUnfilteredNewsItems([]);
        }
      } finally {
        if (!isBackgroundRefresh) setLoading(false);
      }
    };

    loadNews();

    // Realtime updates: the backend keyword cache rebuilds every 2 minutes,
    // so poll on the same cadence and let tags grow/shrink/appear in place
    const REFRESH_INTERVAL_MS = 2 * 60 * 1000;
    const refreshTimer = setInterval(() => loadNews(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimer);
  }, [selectedCategory, enabledBiases]);

  // Compute displayed words based on enabled biases, types, AND selected category
  const displayedWords = useMemo(() => {
    console.log(`Filtering ${allTagCloudWords.length} total words by biases: [${Array.from(enabledBiases).join(', ')}], types: [${Array.from(enabledTypes).join(', ')}] and category: ${selectedCategory}`);

    let filtered = allTagCloudWords;

    // 1. Filter by enabled biases. Like source types, a word matches by its
    // DOMINANT bias — the one that picks its color — so soloing Left shows
    // only blue words.
    if (enabledBiases.size < Object.values(PoliticalBias).length) { // Only filter if not all biases are enabled
      filtered = filtered.filter(word => enabledBiases.has(getDominantBias(word)));
    }

    // 2. Filter by enabled source types. A word matches by its DOMINANT type —
    // the same one that picks its font — so soloing State shows only the
    // words rendered in the State font, not everything BBC happens to mention.
    if (enabledTypes.size < Object.values(SourceType).length) { // Only filter if not all types are enabled
      filtered = filtered.filter(word => enabledTypes.has(getDominantSourceType(word)));
    }

    // 3. Filter by selected category (if not 'all')
    if (selectedCategory && selectedCategory.toLowerCase() !== 'all') {
      const upperCaseCategory = selectedCategory.toUpperCase(); // Match backend enum case
      // Check if the word's categories array includes the selected category
      filtered = filtered.filter(word => word.categories && word.categories.includes(upperCaseCategory as NewsCategory));
    }

    console.log(`Displaying ${filtered.length} words after filtering.`);
    return filtered;
    // Ensure all filter dependencies are in the dependency array
  }, [allTagCloudWords, enabledBiases, enabledTypes, selectedCategory]);

  const handleWordSelect = React.useCallback(async (word: TagCloudWord, clickPosition: { top: number; left: number }) => {
    if (!word || !word.text) {
      console.warn('handleWordSelect called with invalid word:', word);
      return;
    }
    // Prevent duplicate windows for the same word
    if (openNewsWindows.some(w => w.wordData.text === word.text)) {
      return;
    }

    console.log(`Fetching related articles from backend for: "${word.text}"`);
    setError(null); // Clear previous errors
    // Optionally, set a specific loading state for this window if desired
    // setLoadingTagNews(true); 

    try {
      const response = await axios.get(`${API_BASE_URL}/news/by-tag`, {
        params: {
          tag: word.text,
          // Scope popup articles to the category being viewed
          category: selectedCategory && selectedCategory !== 'all' ? selectedCategory : undefined
        }
      });

      const relatedNews: NewsItem[] = response.data;
      console.log(`Found ${relatedNews.length} related articles from backend for "${word.text}".`);

      if (relatedNews.length > 0) {
        setOpenNewsWindows(prev => [
          ...prev,
          { wordData: word, newsItems: relatedNews, position: clickPosition }
        ]);
      } else {
        console.warn(`No related news found from backend for tag "${word.text}", though tag was displayed.`);
        // Optionally, still open an empty window or show a specific message
        setOpenNewsWindows(prev => [
          ...prev,
          { wordData: word, newsItems: [], position: clickPosition } // Open with empty items
        ]);
        // setError(`No articles found with "${word.text}" in the headline.`);
      }
    } catch (err: any) {
      console.error(`Error fetching articles for tag "${word.text}":`, err);
      setError(`Failed to load articles for "${word.text}": ${err.message}`);
      // Optionally, don't open the window or open an empty one with an error message inside
    }
    // finally {
    //   setLoadingTagNews(false);
    // }
  }, [openNewsWindows, selectedCategory]);

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
              ALL
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
                  allTagCloudWords.length > 0 ? (
                    <div className="loading-indicator">No tags match your current Bias/Type/Category filters.</div>
                  ) : (
                    <div className="loading-indicator">No articles found or sources returned empty. Check API keys and source settings.</div>
                  )
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
              clickedWordBias={getDominantBias(win.wordData)}
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
