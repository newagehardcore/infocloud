import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import TagCloud3DOptimized from './components/TagCloud3DOptimized';
import NewsDetail from './components/NewsDetail';
import TimeControls from './components/TimeControls';
import RelatedNewsPanel from './components/RelatedNewsPanel';
import ResponsiveContainer from './components/ResponsiveContainer';
import ApiDebugPanel, { API_SOURCE_CHANGE_EVENT, RSS_FEED_TOGGLE_EVENT } from './components/ApiDebugPanel';
import { NewsCategory, NewsItem, TagCloudWord, PoliticalBias } from './types';
import { fetchNewsFromAPI, DEFAULT_RSS_FEEDS, getRssFeedState } from './services/newsService';
import { getTimeSnapshot, createTimeSnapshot } from './services/timeSnapshotService';
import { processNewsToWords, DEFAULT_WORD_PROCESSING_CONFIG, analyzeWordDistribution } from './utils/wordProcessing';
import { detectDeviceCapabilities } from './utils/performance';
import { preloadFonts } from './utils/fonts';
import { FilterProvider } from './contexts/FilterContext';
import LoadingBar from './components/LoadingBar';
import './App.css';
import './components/TagFonts.css';

// Custom event name for bias updates
export const BIAS_UPDATE_EVENT = 'biasUpdate';

// Flag to show the debug panel - true for development, false for production
const SHOW_DEBUG_PANEL = process.env.NODE_ENV === 'development' || true; // Set to true to always show it during testing

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

const App: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory>(NewsCategory.All);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [unfilteredNewsItems, setUnfilteredNewsItems] = useState<NewsItem[]>([]); // Store unfiltered items
  const [allTagCloudWords, setAllTagCloudWords] = useState<TagCloudWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceCapabilities, setDeviceCapabilities] = useState(detectDeviceCapabilities());
  const [apiSourceChangeCount, setApiSourceChangeCount] = useState(0);
  const [enabledBiases, setEnabledBiases] = useState<Set<PoliticalBias>>(() => {
    // Initialize bias state from localStorage
    const savedBiases = localStorage.getItem('enabled_biases');
    return savedBiases ? new Set(JSON.parse(savedBiases) as PoliticalBias[]) : new Set(Object.values(PoliticalBias));
  });
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoadingBar, setShowLoadingBar] = useState(false);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to track seen URLs within a single load cycle for deduplication
  const seenUrlsRef = useRef<Set<string>>(new Set());

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

  // Listen for bias update events and update state + localStorage
  useEffect(() => {
    const handleBiasUpdate = () => {
      const savedBiases = localStorage.getItem('enabled_biases');
      const currentEnabledBiases = savedBiases ? 
        new Set(JSON.parse(savedBiases) as PoliticalBias[]) : 
        new Set(Object.values(PoliticalBias));
      
      console.log('Bias update event detected. Current enabled biases:', Array.from(currentEnabledBiases));
      setEnabledBiases(currentEnabledBiases); // Update state

      // Re-filter the *current* unfiltered items based on the new bias set
      console.log(`Re-filtering ${unfilteredNewsItems.length} unfiltered items based on enabled biases`);
      const biasFilteredNews = filterNewsByBias(unfilteredNewsItems, currentEnabledBiases);
      setNewsItems(filterLast24Hours(biasFilteredNews)); // Update displayed items
    };

    window.addEventListener(BIAS_UPDATE_EVENT, handleBiasUpdate);
    return () => {
      window.removeEventListener(BIAS_UPDATE_EVENT, handleBiasUpdate);
    };
  }, [unfilteredNewsItems]); // Re-run filtering if unfiltered items change too (optional)

  // Callback function to handle incoming news batches
  const handleNewsReceived = useCallback((newItemsBatch: NewsItem[]) => {
    if (newItemsBatch && newItemsBatch.length > 0) {
      // Deduplicate incoming batch against already seen URLs in this load cycle
      const uniqueNewItems = newItemsBatch.filter(item => {
        if (item.url && !seenUrlsRef.current.has(item.url)) {
          seenUrlsRef.current.add(item.url);
          return true;
        }
        return false;
      });

      if (uniqueNewItems.length > 0) {
        // Append to unfiltered list
        setUnfilteredNewsItems(prev => [...prev, ...uniqueNewItems]);

        // Filter these new unique items by the current bias setting
        const biasFilteredNewItems = filterNewsByBias(uniqueNewItems, enabledBiases);
        
        // Append bias-filtered items to the displayed list
        setNewsItems(filterLast24Hours(biasFilteredNewItems));
      }
    }
    // Note: Word processing is now handled in a separate useEffect dependent on newsItems
  }, [enabledBiases]); // Dependency on enabledBiases ensures correct filtering

  // Main effect for loading news data when category or sources change
  useEffect(() => {
    const loadNews = async () => {
      console.log('Starting loadNews for category:', selectedCategory);
      setLoading(true);
      setError(null);
      setNewsItems([]); // Clear previous items immediately
      setUnfilteredNewsItems([]); // Clear unfiltered items
      setAllTagCloudWords([]); // Clear words
      seenUrlsRef.current.clear(); // Reset seen URLs for the new load cycle

      try {
        // Start fetching news, providing the callback
        await fetchNewsFromAPI(selectedCategory, handleNewsReceived);
        // The actual data processing and state updates happen within handleNewsReceived
        
      } catch (error) {
        console.error('Error initiating news loading sequence:', error);
        setError('Failed to start loading news data.');
        setLoading(false); // Ensure loading is false on initial error
      } finally {
         // Set loading to false once the fetch initiation is done. 
         // Items will continue to stream in via the callback.
         setLoading(false); 
      }
    };

    loadNews();

    // Removing the interval for now, consider a different refresh strategy if needed
    // const interval = setInterval(loadNews, 5 * 60 * 1000);
    // return () => {
    //   if (interval) clearInterval(interval);
    // };
  }, [selectedCategory, apiSourceChangeCount, handleNewsReceived]); // Dependencies

  // Effect for processing all words whenever newsItems changes (no bias filtering here)
  useEffect(() => {
    if (newsItems.length > 0 && !loading) {
      const processWords = async () => {
        console.log(`Processing ALL words for ${newsItems.length} news items (no bias filter)`);
        const words = await processNewsToWords(newsItems, {
          ...DEFAULT_WORD_PROCESSING_CONFIG,
          minFrequency: 1,
          maxWords: 500, // Adjust as needed
          minWordLength: 2,
          removeStopWords: true,
          combineWordForms: false
        });
        setAllTagCloudWords(words);
      };
      processWords();
    } else if (newsItems.length === 0 && !loading) {
      setAllTagCloudWords([]);
    }
  }, [newsItems, loading]);

  // Compute displayed words based on enabled biases (fast, in-memory)
  const displayedWords = allTagCloudWords.filter(word => enabledBiases.has(word.bias));

  const handleCategoryChange = (category: NewsCategory) => {
    setSelectedCategory(category);
    setSelectedWord(null);
    setRelatedNews([]); // Also clear related news on category change
  };

  const handleWordSelect = (word: TagCloudWord) => {
    const wordText = word.text;
    if (selectedWord === wordText) {
      setSelectedWord(null);
      setRelatedNews([]);
    } else {
      setSelectedWord(wordText);
      // Find related news items
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
    if (newsItems.length > 0 && !loading) {
      startLoadingBar();
    }
  }, [newsItems, loading]);

  // Finish loading bar when words are ready
  useEffect(() => {
    if (allTagCloudWords.length > 0 && !loading) {
      finishLoadingBar();
    }
  }, [allTagCloudWords, loading]);

  return (
    <FilterProvider>
      <LoadingBar progress={loadingProgress} visible={showLoadingBar} />
      <Router>
        <div className="App">
          <Header 
            onSelectCategory={handleCategoryChange}
            selectedCategory={selectedCategory} 
          />
          {SHOW_DEBUG_PANEL && <ApiDebugPanel visible={true} />}
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
          {/* <TimeControls /> */}
        </div>
      </Router>
    </FilterProvider>
  );
};

export default App;
