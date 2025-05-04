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
  toggleBias: (bias: PoliticalBias, event?: React.MouseEvent<HTMLButtonElement>) => void;
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

  // State to store biases before a solo action
  const [previousBiasSet, setPreviousBiasSet] = useState<Set<PoliticalBias> | null>(null);

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

  // Toggle a political bias with modifier key support
  const toggleBias = (bias: PoliticalBias, event?: React.MouseEvent<HTMLButtonElement>) => {
    if (!Object.values(PoliticalBias).includes(bias)) {
      console.error('Invalid bias value:', bias);
      return;
    }

    let newEnabledBiases: Set<PoliticalBias>;
    let isNowEnabled: boolean | undefined;

    // Command/Ctrl + Click logic
    if (event && (event.metaKey || event.ctrlKey)) {
      // Check if the clicked bias is ALREADY the only one selected
      if (enabledBiases.size === 1 && enabledBiases.has(bias)) {
        console.log(`Inverting solo for bias: ${bias} (selecting all others)`);
        // Select all biases EXCEPT the clicked one
        newEnabledBiases = new Set(Object.values(PoliticalBias));
        newEnabledBiases.delete(bias);
        setPreviousBiasSet(null); // Clear previous state as this isn't a reversible solo
        isNowEnabled = false; // The clicked bias is now disabled
      } else {
        // Standard Solo: Select only the clicked bias
        console.log(`Soloing bias: ${bias}`);
        // Store current state *only if* not already soloing this specific bias
        if (enabledBiases.size !== 1 || !enabledBiases.has(bias)) {
            setPreviousBiasSet(new Set(enabledBiases)); 
        }
        newEnabledBiases = new Set([bias]);
        isNowEnabled = true; // The clicked bias is now enabled
      }
    } 
    // Shift + Click: Reverse solo ONLY if this bias is currently soloed and we have a previous state
    else if (event && event.shiftKey && enabledBiases.size === 1 && enabledBiases.has(bias) && previousBiasSet) {
      console.log(`Reversing solo for bias: ${bias}`);
      newEnabledBiases = new Set(previousBiasSet); // Restore previous set
      setPreviousBiasSet(null); // Clear the stored set
      isNowEnabled = newEnabledBiases.has(bias); // Status depends on previous set
    } 
    // Normal toggle
    else {
      console.log(`Toggling bias: ${bias}, current status: ${enabledBiases.has(bias) ? 'enabled' : 'disabled'}`);
      newEnabledBiases = new Set(enabledBiases);
      if (newEnabledBiases.has(bias)) {
        newEnabledBiases.delete(bias);
        isNowEnabled = false;
      } else {
        newEnabledBiases.add(bias);
        isNowEnabled = true;
      }
       // If a normal toggle happens, clear any previous solo state
       setPreviousBiasSet(null);
    }
    
    // Avoid unnecessary state updates/events if the set didn't actually change
    if (setsAreEqual(enabledBiases, newEnabledBiases)) {
        console.log('Bias set unchanged, skipping update.');
        return;
    }

    setEnabledBiases(newEnabledBiases);
    
    // Save to localStorage
    localStorage.setItem('enabled_biases', JSON.stringify(Array.from(newEnabledBiases)));
    console.log('Saved to localStorage:', JSON.stringify(Array.from(newEnabledBiases)));
    
    // Dispatch event (only if state actually changed)
    const finalEnabledStatus = newEnabledBiases.has(bias);
    window.dispatchEvent(new CustomEvent<BiasUpdateDetail>(BIAS_UPDATE_EVENT, {
      detail: {
        bias,
        enabled: finalEnabledStatus
      }
    }));
  };

  // Helper function to compare sets (order doesn't matter)
  const setsAreEqual = (setA: Set<any>, setB: Set<any>) => {
      if (setA.size !== setB.size) return false;
      // Convert setA to an array to iterate safely
      for (const item of Array.from(setA)) {
          if (!setB.has(item)) return false;
      }
      return true;
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