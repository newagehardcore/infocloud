import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PoliticalBias } from '../types';
import { DEFAULT_RSS_FEEDS } from '../services/newsService';
import { BIAS_UPDATE_EVENT } from '../App';
import { API_SOURCE_CHANGE_EVENT, RSS_FEED_TOGGLE_EVENT } from '../components/ApiDebugPanel';

interface ApiSource {
  name: string;
  enabled: boolean;
  working: boolean;
}

interface RssFeed {
  name: string;
  url: string;
  enabled: boolean;
}

interface FilterContextType {
  // Bias filters
  enabledBiases: Set<PoliticalBias>;
  toggleBias: (bias: PoliticalBias) => void;
  
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
    if (savedBiases) {
      try {
        // Parse the saved biases
        const parsedBiases = JSON.parse(savedBiases) as string[];
        // Create a Set with valid PoliticalBias values
        return new Set(parsedBiases.filter(b => 
          Object.values(PoliticalBias).includes(b as PoliticalBias)
        ) as PoliticalBias[]);
      } catch (e) {
        console.error('Error parsing saved biases:', e);
        return new Set(Object.values(PoliticalBias));
      }
    } else {
      return new Set(Object.values(PoliticalBias));
    }
  });

  // API sources state
  const [apiSources, setApiSources] = useState<ApiSource[]>([
    { name: 'NewsAPI', enabled: false, working: false },
    { name: 'GNews', enabled: false, working: false },
    { name: 'TheNewsAPI', enabled: false, working: false },
    { name: 'RSS', enabled: true, working: false }
  ]);

  // RSS feeds state
  const [rssFeeds, setRssFeeds] = useState<RssFeed[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    // Load API states
    const newApiSources = [...apiSources];
    newApiSources.forEach((api, index) => {
      const savedState = localStorage.getItem(`api_${api.name.replace(/\s+/g, '')}_enabled`);
      if (savedState !== null) {
        newApiSources[index] = { ...api, enabled: savedState === 'true' };
      }
    });
    setApiSources(newApiSources);

    // Load RSS feed states from localStorage
    const feeds = DEFAULT_RSS_FEEDS.map(feed => {
      const feedId = `rssfeed_${feed.name.replace(/\s+/g, '_')}`;
      const savedEnabled = localStorage.getItem(feedId);
      return {
        name: feed.name,
        url: feed.url,
        enabled: savedEnabled === null ? true : savedEnabled === 'true'
      };
    });
    setRssFeeds(feeds);
  }, []);

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
    if (newEnabledBiases.has(bias)) {
      newEnabledBiases.delete(bias);
      console.log(`Removed ${bias}, now enabled biases:`, Array.from(newEnabledBiases));
    } else {
      newEnabledBiases.add(bias);
      console.log(`Added ${bias}, now enabled biases:`, Array.from(newEnabledBiases));
    }
    setEnabledBiases(newEnabledBiases);
    
    // Save to localStorage
    localStorage.setItem('enabled_biases', JSON.stringify(Array.from(newEnabledBiases)));
    console.log('Saved to localStorage:', JSON.stringify(Array.from(newEnabledBiases)));
    
    // Dispatch event for real-time updates
    console.log(`Dispatching ${BIAS_UPDATE_EVENT} event`);
    window.dispatchEvent(new Event(BIAS_UPDATE_EVENT));
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
      localStorage.setItem(`api_${apiName.replace(/\s+/g, '')}_enabled`, apiToUpdate.enabled ? 'true' : 'false');
    }
    
    // Dispatch custom event to trigger news refresh
    const event = new CustomEvent(API_SOURCE_CHANGE_EVENT, { 
      detail: { apiName, enabled: apiToUpdate?.enabled } 
    });
    window.dispatchEvent(event);
  };

  // Toggle an RSS feed
  const toggleRssFeed = (feedName: string) => {
    const updatedFeeds = rssFeeds.map(feed => 
      feed.name === feedName ? { ...feed, enabled: !feed.enabled } : feed
    );
    setRssFeeds(updatedFeeds);
    
    // Update localStorage
    const feedToUpdate = updatedFeeds.find(feed => feed.name === feedName);
    if (feedToUpdate) {
      const feedId = `rssfeed_${feedName.replace(/\s+/g, '_')}`;
      localStorage.setItem(feedId, feedToUpdate.enabled ? 'true' : 'false');
    }
    
    // Dispatch events for real-time updates
    window.dispatchEvent(new Event(API_SOURCE_CHANGE_EVENT));
    const rssFeedEvent = new CustomEvent(RSS_FEED_TOGGLE_EVENT, {
      detail: { feedName, enabled: feedToUpdate?.enabled }
    });
    window.dispatchEvent(rssFeedEvent);
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
    window.dispatchEvent(new Event(API_SOURCE_CHANGE_EVENT));
    window.dispatchEvent(new Event(RSS_FEED_TOGGLE_EVENT));
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
    window.dispatchEvent(new Event(API_SOURCE_CHANGE_EVENT));
    
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
      window.dispatchEvent(new Event(API_SOURCE_CHANGE_EVENT));
    }, 10000);
  };

  const value = {
    enabledBiases,
    toggleBias,
    apiSources,
    toggleApiSource,
    rssFeeds,
    toggleRssFeed,
    toggleAllRssFeeds,
    testAllApis,
    isTesting
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}; 