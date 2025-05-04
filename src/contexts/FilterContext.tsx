import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PoliticalBias, NewsCategory } from '../types';

// Move the event name constant here and export it
export const BIAS_UPDATE_EVENT = 'bias-update';

interface ApiSource {
  name: string;
  enabled: boolean;
  working: boolean;
}

interface RssFeed {
  name: string;
  enabled: boolean;
}

interface BiasUpdateDetail {
  bias: PoliticalBias;
  enabled: boolean;
}

interface FilterContextType {
  // Bias filters
  enabledBiases: Set<PoliticalBias>;
  toggleBias: (bias: PoliticalBias) => void;
  isEnabled: (bias: PoliticalBias) => boolean;
  
  // Category filter (NEW)
  selectedCategory: NewsCategory | 'all'; // Can be a specific category or 'all'
  setSelectedCategory: (category: NewsCategory | 'all') => void;
  
  // API sources
  apiSources: ApiSource[];
  toggleApiSource: (apiName: string) => void;
  
  // RSS feeds
  rssFeeds: RssFeed[];
  toggleRssFeed: (feedName: string) => void;
  toggleAllRssFeeds: (enabled: boolean) => void;
  
  // Testing
  testAllApis: () => void;
  isTesting: boolean;
  setIsTesting: React.Dispatch<React.SetStateAction<boolean>>;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

interface FilterProviderProps {
  children: ReactNode;
}

export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
  // Political bias state
  const [enabledBiases, setEnabledBiases] = useState<Set<PoliticalBias>>(() => {
    const savedBiases = localStorage.getItem('enabled_biases');
    let initialBiases = new Set(Object.values(PoliticalBias));
    if (savedBiases) {
      try {
        const parsed = JSON.parse(savedBiases) as string[];
        const validBiases = parsed.filter(b => Object.values(PoliticalBias).includes(b as PoliticalBias));
        if (validBiases.length > 0) {
          initialBiases = new Set(validBiases as PoliticalBias[]);
        }
      } catch (e) {
         console.error("Failed to parse biases from localStorage", e);
      }
    } else {
      // If no biases are saved, enable all biases by default
      localStorage.setItem('enabled_biases', JSON.stringify(Object.values(PoliticalBias)));
    }
    return initialBiases;
  });

  // Category filter state (NEW)
  const [selectedCategory, setSelectedCategoryState] = useState<NewsCategory | 'all'>(() => {
    const savedCategory = localStorage.getItem('selected_category');
    // Default to 'all' if nothing is saved or if saved value is invalid
    if (savedCategory && (Object.values(NewsCategory).includes(savedCategory as NewsCategory) || savedCategory === 'all')) {
      return savedCategory as NewsCategory | 'all';
    }
    return 'all'; // Default to 'all'
  });

  // API sources state (keep for potential future use)
  const [apiSources, setApiSources] = useState<ApiSource[]>([
    { name: 'NewsAPI', enabled: false, working: false },
    { name: 'GNews', enabled: false, working: false },
    { name: 'TheNewsAPI', enabled: false, working: false },
    // { name: 'RSS', enabled: true, working: false } // Remove if not actively used
  ]);

  // RSS feeds state - This might need to be fetched from backend or managed differently
  const [rssFeeds, setRssFeeds] = useState<RssFeed[]>([]); // Keep state, but initialization logic removed
  const [isTesting, setIsTesting] = useState(false); // Keep if used

  // Effect to load initial state for API sources and RSS feeds from localStorage
  useEffect(() => {
    // Load API source states
    const updatedApiSources = apiSources.map(api => {
      const savedEnabled = localStorage.getItem(`api_${api.name.replace(/\s+/g, '')}_enabled`);
      return savedEnabled !== null ? { ...api, enabled: savedEnabled === 'true' } : api;
    });
    setApiSources(updatedApiSources);

    // Load RSS feed states from localStorage (Old logic using DEFAULT_RSS_FEEDS removed)
    // How RSS feed state (enabled/disabled) is managed needs reconsideration.
    // For now, initialize rssFeeds as empty or fetch from backend if an endpoint exists.
    setRssFeeds([]); // Initialize as empty for now
    
    /* Old Logic: 
    const feeds = DEFAULT_RSS_FEEDS.map(feed => {
      const feedId = `rssfeed_${feed.name.replace(/\s+/g, '_')}`;
      const savedEnabled = localStorage.getItem(feedId);
      return {
        name: feed.name,
        enabled: savedEnabled !== null ? savedEnabled === 'true' : true, // Default to true
      };
    });
    setRssFeeds(feeds);
    */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Update working status for APIs periodically
  useEffect(() => {
    const checkWorkingStatus = () => {
      setApiSources(prevApis => 
        prevApis.map(api => {
          const workingStatus = localStorage.getItem(`api_${api.name.replace(/\s+/g, '')}_working`);
          return {
            ...api,
            working: workingStatus === 'true'
          };
        })
      );
    };

    // Check immediately
    checkWorkingStatus();
    
    // Set up interval to check working status periodically
    const interval = setInterval(checkWorkingStatus, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Toggle a political bias
  const toggleBias = (bias: PoliticalBias) => {
    if (!Object.values(PoliticalBias).includes(bias)) {
      console.error('Invalid bias value:', bias);
      return;
    }
    
    console.log(`Toggling bias: ${bias}, current status: ${enabledBiases.has(bias) ? 'enabled' : 'disabled'}`);
    
    const newEnabledBiases = new Set(enabledBiases);
    const isEnabled = !newEnabledBiases.has(bias);
    if (isEnabled) {
      newEnabledBiases.add(bias);
    } else {
      newEnabledBiases.delete(bias);
    }
    setEnabledBiases(newEnabledBiases);
    
    // Save to localStorage
    localStorage.setItem('enabled_biases', JSON.stringify(Array.from(newEnabledBiases)));
    console.log('Saved to localStorage:', JSON.stringify(Array.from(newEnabledBiases)));
    
    // Dispatch a more specific event with details about which bias changed
    window.dispatchEvent(new CustomEvent<BiasUpdateDetail>(BIAS_UPDATE_EVENT, {
      detail: {
        bias,
        enabled: isEnabled
      }
    }));
  };

  const isEnabled = (bias: PoliticalBias) => enabledBiases.has(bias);

  // Set the selected category (NEW wrapper function to save to localStorage)
  const setSelectedCategory = (category: NewsCategory | 'all') => {
    setSelectedCategoryState(category);
    localStorage.setItem('selected_category', category);
    // Optional: Dispatch an event if other components need to react instantly
    // window.dispatchEvent(new CustomEvent('category_change', { detail: { category } }));
  };

  // Toggle an API source
  const toggleApiSource = (apiName: string) => {
    const updatedSources = apiSources.map(api => 
      api.name === apiName ? { ...api, enabled: !api.enabled } : api
    );
    setApiSources(updatedSources);
    
    // Update localStorage
    const apiToUpdate = updatedSources.find(api => api.name === apiName);
    if (apiToUpdate) {
      localStorage.setItem(`api_${apiToUpdate.name.replace(/\s+/g, '')}_enabled`, apiToUpdate.enabled ? 'true' : 'false');
    }
    
    // Dispatch custom event to trigger news refresh
    // const event = new CustomEvent(API_SOURCE_CHANGE_EVENT, { 
    //   detail: { apiName, enabled: apiToUpdate?.enabled } 
    // });
    // window.dispatchEvent(event);
  };

  // Toggle an RSS feed's enabled state
  const toggleRssFeed = (feedName: string) => {
    // This logic needs adjustment as rssFeeds state might not be populated correctly
    // const updatedFeeds = rssFeeds.map(feed =>
    //   feed.name === feedName ? { ...feed, enabled: !feed.enabled } : feed
    // );
    // setRssFeeds(updatedFeeds);
    
    // // Update localStorage
    // const feedToUpdate = updatedFeeds.find(feed => feed.name === feedName);
    // if (feedToUpdate) {
    //   const feedId = `rssfeed_${feedToUpdate.name.replace(/\s+/g, '_')}`;
    //   localStorage.setItem(feedId, feedToUpdate.enabled ? 'true' : 'false');
    // }
    
    // // Dispatch custom event if needed for RSS toggles
    // const event = new CustomEvent(RSS_FEED_TOGGLE_EVENT, { 
    //   detail: { feedName, enabled: feedToUpdate?.enabled } 
    // });
    // window.dispatchEvent(event);
    console.warn(`toggleRssFeed for "${feedName}" needs reimplementation based on new state management.`);
  };

  // Toggle all RSS feeds
  const toggleAllRssFeeds = (enabled: boolean) => {
    const updatedFeeds = rssFeeds.map(feed => ({ ...feed, enabled }));
    setRssFeeds(updatedFeeds);
    
    // Update localStorage for all feeds
    updatedFeeds.forEach(feed => {
      const feedId = `rssfeed_${feed.name.replace(/\s+/g, '_')}`;
      localStorage.setItem(feedId, enabled ? 'true' : 'false');
    });
    
    // Dispatch events for real-time updates
    // window.dispatchEvent(new Event(API_SOURCE_CHANGE_EVENT));
    // window.dispatchEvent(new Event(RSS_FEED_TOGGLE_EVENT));
  };

  // Test all APIs
  const testAllApis = () => {
    setIsTesting(true);
    
    // Enable all APIs temporarily
    const previousStates = apiSources.map(api => ({
      name: api.name,
      enabled: api.enabled
    }));
    
    // Set all APIs to enabled
    const enabledApis = apiSources.map(api => ({ ...api, enabled: true }));
    setApiSources(enabledApis);
    
    // Update localStorage for all APIs
    enabledApis.forEach(api => {
      localStorage.setItem(`api_${api.name.replace(/\s+/g, '')}_enabled`, 'true');
    });
    
    // Dispatch event to trigger immediate refresh
    // window.dispatchEvent(new Event(API_SOURCE_CHANGE_EVENT));
    
    // After 10 seconds, restore previous states
    setTimeout(() => {
      const restoredApis = apiSources.map(api => {
        const previousState = previousStates.find(s => s.name === api.name);
        return { ...api, enabled: previousState?.enabled ?? api.enabled };
      });
      
      setApiSources(restoredApis);
      
      // Update localStorage with restored states
      restoredApis.forEach(api => {
        localStorage.setItem(`api_${api.name.replace(/\s+/g, '')}_enabled`, api.enabled ? 'true' : 'false');
      });
      
      setIsTesting(false);
      
      // Dispatch event to update UI
      // window.dispatchEvent(new Event(API_SOURCE_CHANGE_EVENT));
    }, 10000);
  };

  const value = {
    enabledBiases,
    toggleBias,
    isEnabled,
    selectedCategory,
    setSelectedCategory,
    apiSources,
    toggleApiSource,
    rssFeeds,
    toggleRssFeed,
    toggleAllRssFeeds,
    testAllApis,
    isTesting,
    setIsTesting
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}; 