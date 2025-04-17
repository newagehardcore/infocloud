import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import axios from 'axios';
import Header from './components/Header';
import TagCloud3DOptimized from './components/TagCloud3DOptimized';
import RelatedNewsPanel from './components/RelatedNewsPanel';
import ResponsiveContainer from './components/ResponsiveContainer';
import { NewsCategory, NewsItem, TagCloudWord, PoliticalBias } from './types';
import { processNewsToWords, DEFAULT_WORD_PROCESSING_CONFIG } from './utils/wordProcessing';
import { preloadFonts } from './utils/fonts';
import { FilterProvider, useFilters, BIAS_UPDATE_EVENT } from './contexts/FilterContext';
import LoadingBar from './components/LoadingBar';
import './App.css';
import './components/TagFonts.css';

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

const App: React.FC = () => {
  const { enabledBiases } = useFilters();
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory>(NewsCategory.All);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [unfilteredNewsItems, setUnfilteredNewsItems] = useState<NewsItem[]>([]);
  const [allTagCloudWords, setAllTagCloudWords] = useState<TagCloudWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoadingBar, setShowLoadingBar] = useState(false);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [words, setWords] = useState<WordData[]>([]);
  const [wordsByBias, setWordsByBias] = useState<Record<PoliticalBias, WordData[]>>({
    [PoliticalBias.AlternativeLeft]: [],
    [PoliticalBias.MainstreamDemocrat]: [],
    [PoliticalBias.Centrist]: [],
    [PoliticalBias.Unclear]: [],
    [PoliticalBias.MainstreamRepublican]: [],
    [PoliticalBias.AlternativeRight]: []
  });

  // Preload fonts on app initialization
  useEffect(() => {
    preloadFonts();
  }, []);

  // Listen for bias update events and update state + localStorage
  useEffect(() => {
    const handleBiasUpdate = () => {
      const savedBiases = localStorage.getItem('enabled_biases');
      const currentEnabledBiases = savedBiases ?
        new Set(JSON.parse(savedBiases) as PoliticalBias[]) :
        new Set(Object.values(PoliticalBias)); // Default to all if parse fails or empty

      console.log('Bias update event detected. Current enabled biases:', Array.from(currentEnabledBiases));
      localStorage.setItem('enabled_biases', JSON.stringify(Array.from(currentEnabledBiases)));

      // Re-filter the *current* unfiltered items based on the new bias set
      console.log(`Re-filtering ${unfilteredNewsItems.length} unfiltered items based on enabled biases`);
      const biasFilteredNews = filterNewsByBias(unfilteredNewsItems, currentEnabledBiases);
      // Apply 24-hour filter AFTER bias filtering
      setNewsItems(filterLast24Hours(biasFilteredNews));
    };

    window.addEventListener(BIAS_UPDATE_EVENT, handleBiasUpdate);
    return () => {
      window.removeEventListener(BIAS_UPDATE_EVENT, handleBiasUpdate);
    };
  }, [unfilteredNewsItems]); // Dependency on unfilteredNewsItems ensures re-filtering when new base data arrives

  // Refactored main effect for loading news data
  useEffect(() => {
    const loadNews = async () => {
      console.log(`Starting loadNews for category: ${selectedCategory}`);
      setLoading(true);
      setError(null);
      setNewsItems([]); // Clear previous items
      setUnfilteredNewsItems([]); // Clear unfiltered items
      setAllTagCloudWords([]); // Clear words

      // --- API Call Setup ---
      const params: Record<string, any> = {
          limit: 1000, // Fetch a large number, frontend will filter by time/bias
          // Add category filter if not 'All'
          ...(selectedCategory !== NewsCategory.All && { category: selectedCategory }),
          // Add other potential query params here if needed (e.g., search term 'q')
      };

      try {
        console.log(`Fetching from: ${API_BASE_URL}/api/news`, { params });
        const response = await axios.get(`${API_BASE_URL}/api/news`, { params });

        if (response.data && response.data.data) {
          console.log(`Received ${response.data.data.length} items from backend.`);
          // Store all received items (before time/bias filtering)
          setUnfilteredNewsItems(response.data.data);

          // Apply initial bias filtering based on current state
          const biasFiltered = filterNewsByBias(response.data.data, enabledBiases);

          // Apply 24-hour filter
          const timeFiltered = filterLast24Hours(biasFiltered);
          setNewsItems(timeFiltered);
          console.log(`Displaying ${timeFiltered.length} items after bias and time filtering.`);

        } else {
          console.warn('No data received from backend or unexpected format.');
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

    // No interval refresh for now, focus on initial load + category change
  }, [selectedCategory, enabledBiases]); // Re-fetch when category changes, re-filter when biases change (handled by bias update listener)

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
    setRelatedNews([]);
  };

  const handleWordSelect = (word: TagCloudWord) => {
    const wordText = word.text;
    if (selectedWord === wordText) {
      setSelectedWord(null);
      setRelatedNews([]);
    } else {
      setSelectedWord(wordText);
      // Find related news items from the *currently displayed* items
      const related = newsItems.filter(item =>
        (item.title.toLowerCase().includes(wordText.toLowerCase()) ||
         item.description.toLowerCase().includes(wordText.toLowerCase()) ||
         item.keywords?.some(kw => kw.toLowerCase() === wordText.toLowerCase())) &&
         item.url // Ensure item has a URL
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

  return (
    <Router>
      <div className="app">
        <LoadingBar progress={loadingProgress} visible={showLoadingBar} />
        <Header 
          onSelectCategory={handleCategoryChange} 
          currentCategory={selectedCategory} 
          selectedCategory={selectedCategory} 
        />
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
          {selectedWord && relatedNews.length > 0 && (
            <RelatedNewsPanel
              newsItems={relatedNews}
              selectedKeyword={selectedWord}
              onClose={handleCloseRelatedNews}
            />
          )}
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
