import React, { useEffect, useState } from 'react';
import './ApiDebugPanel.css';
import { DEFAULT_RSS_FEEDS } from '../services/newsService';

interface ApiStatus {
  name: string;
  enabled: boolean;
  working: boolean;
  toggleEnabled: (enabled: boolean) => void;
}

interface RssFeed {
  name: string;
  url: string;
  enabled: boolean;
  toggleEnabled: (enabled: boolean) => void;
}

interface ApiDebugPanelProps {
  visible: boolean;
}

// Create a custom event type for API source changes
export const API_SOURCE_CHANGE_EVENT = 'api-source-change';
export const RSS_FEED_TOGGLE_EVENT = 'rss-feed-toggle';

const ApiDebugPanel: React.FC<ApiDebugPanelProps> = ({ visible }) => {
  const [apis, setApis] = useState<ApiStatus[]>([
    { name: 'NewsAPI', enabled: false, working: false, toggleEnabled: () => {} },
    { name: 'GNews', enabled: false, working: false, toggleEnabled: () => {} },
    { name: 'TheNewsAPI', enabled: false, working: false, toggleEnabled: () => {} },
    { name: 'RSS', enabled: true, working: false, toggleEnabled: () => {} }
  ]);
  const [expanded, setExpanded] = useState(false);
  const [rssExpanded, setRssExpanded] = useState(false);
  const [rssFeeds, setRssFeeds] = useState<RssFeed[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  // Check if APIs have keys defined
  useEffect(() => {
    const newsApiKey = process.env.REACT_APP_NEWS_API_KEY;
    const gNewsApiKey = process.env.REACT_APP_GNEWS_API_KEY;
    const theNewsApiKey = process.env.REACT_APP_THE_NEWS_API_KEY;

    // Create a function to toggle localStorage stored preferences
    const createToggleFunction = (apiName: string) => {
      return (enabled: boolean) => {
        localStorage.setItem(`api_${apiName.replace(/\s+/g, '')}_enabled`, enabled ? 'true' : 'false');
        
        // Update the state
        setApis(prevApis => 
          prevApis.map(api => 
            api.name === apiName ? { ...api, enabled } : api
          )
        );
        
        // Dispatch custom event to trigger news refresh
        const event = new CustomEvent(API_SOURCE_CHANGE_EVENT, { 
          detail: { apiName, enabled } 
        });
        window.dispatchEvent(event);
      };
    };

    // Check if there's a saved preference in localStorage
    const getSavedPreference = (apiName: string, hasKey: boolean): boolean => {
      const savedPref = localStorage.getItem(`api_${apiName.replace(/\s+/g, '')}_enabled`);
      return savedPref === null ? hasKey : savedPref === 'true';
    };

    setApis([
      { 
        name: 'NewsAPI', 
        enabled: getSavedPreference('NewsAPI', !!newsApiKey), 
        working: false,
        toggleEnabled: createToggleFunction('NewsAPI')
      },
      { 
        name: 'GNews', 
        enabled: getSavedPreference('GNews', !!gNewsApiKey), 
        working: false,
        toggleEnabled: createToggleFunction('GNews')
      },
      { 
        name: 'TheNewsAPI', 
        enabled: getSavedPreference('TheNewsAPI', !!theNewsApiKey), 
        working: false,
        toggleEnabled: createToggleFunction('TheNewsAPI')
      },
      {
        name: 'RSS',
        enabled: getSavedPreference('RSS', true), // RSS doesn't need an API key
        working: false,
        toggleEnabled: createToggleFunction('RSS')
      }
    ]);

    // Initialize RSS feeds state
    const feeds = DEFAULT_RSS_FEEDS.map(feed => {
      const feedId = `rssfeed_${feed.name.replace(/\s+/g, '_')}`;
      const savedEnabled = localStorage.getItem(feedId);
      // TypeScript needs explicit check for the disable property
      const defaultDisabled = 'disable' in feed ? !!feed.disable : false;
      const isEnabled = savedEnabled === null ? !defaultDisabled : savedEnabled === 'true';
      
      // Create toggle function for this feed
      const toggleFeed = (enabled: boolean) => {
        localStorage.setItem(feedId, enabled ? 'true' : 'false');
        
        // Update the feed state
        setRssFeeds(prevFeeds => 
          prevFeeds.map(f => 
            f.name === feed.name ? { ...f, enabled } : f
          )
        );
        
        // Dispatch custom event to trigger news refresh
        const event = new CustomEvent(API_SOURCE_CHANGE_EVENT);
        window.dispatchEvent(event);
        
        // Dispatch RSS-specific event for immediate UI update
        const rssFeedEvent = new CustomEvent(RSS_FEED_TOGGLE_EVENT, {
          detail: { feedName: feed.name, enabled }
        });
        window.dispatchEvent(rssFeedEvent);
      };
      
      return {
        name: feed.name,
        url: feed.url,
        enabled: isEnabled,
        toggleEnabled: toggleFeed
      };
    });
    
    setRssFeeds(feeds);
  }, []);

  // Update working status based on fetched data
  useEffect(() => {
    // Check the working status from localStorage that is updated by newsService
    const checkWorkingStatus = () => {
      setApis(prevApis => 
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

  // Function to test all APIs
  const testAllApis = () => {
    setIsTesting(true);
    
    // Enable all APIs temporarily
    const previousStates = apis.map(api => ({
      name: api.name,
      enabled: api.enabled
    }));
    
    // Set all APIs to enabled
    apis.forEach(api => {
      api.toggleEnabled(true);
    });
    
    // Dispatch event to trigger immediate refresh
    const event = new CustomEvent(API_SOURCE_CHANGE_EVENT);
    window.dispatchEvent(event);
    
    // After 10 seconds, restore previous states
    setTimeout(() => {
      previousStates.forEach(state => {
        const api = apis.find(a => a.name === state.name);
        if (api) {
          api.toggleEnabled(state.enabled);
        }
      });
      setIsTesting(false);
    }, 10000);
  };

  // Count how many APIs are enabled
  const enabledCount = apis.filter(api => api.enabled).length;
  
  // Get RSS feed info for display
  const enabledRssCount = rssFeeds.filter(feed => feed.enabled).length;
  const totalRssCount = rssFeeds.length;

  // Toggle the RSS feeds section
  const toggleRssSection = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the event from bubbling up to the main panel
    setRssExpanded(!rssExpanded);
  };

  // Group RSS feeds by category
  const groupedRssFeeds = rssFeeds.reduce((groups, feed) => {
    // Extract category from feed entry position in the array
    let category = 'Uncategorized';
    
    if (feed.name.includes('New York Times') || feed.name.includes('Washington Post') || 
        feed.name.includes('NPR') || feed.name.includes('Vox') || 
        feed.name.includes('Vanity Fair') || feed.name.includes('New Yorker')) {
      category = 'Mainstream Left';
    } else if (feed.name.includes('Mother Jones') || feed.name.includes('Nation') || 
               feed.name.includes('FAIR') || feed.name.includes('Truthout') || 
               feed.name.includes('AlterNet') || feed.name.includes('Intercept')) {
      category = 'Alternative Left';
    } else if (feed.name.includes('BBC') || feed.name.includes('PBS') || 
               feed.name.includes('Reuters') || feed.name.includes('Associated Press')) {
      category = 'Centrist';
    } else if (feed.name.includes('Wall Street Journal') || feed.name.includes('Washington Times') || 
               feed.name.includes('Fox News') || feed.name.includes('New York Post') || 
               feed.name.includes('National Review')) {
      category = 'Mainstream Right';
    } else if (feed.name.includes('Breitbart') || feed.name.includes('Daily Wire') || 
               feed.name.includes('Daily Caller') || feed.name.includes('American Conservative') || 
               feed.name.includes('Political Insider') || feed.name.includes('Unz')) {
      category = 'Alternative Right';
    } else if (feed.name.includes('Economist') || feed.name.includes('CNBC')) {
      category = 'Business/Financial';
    } else if (feed.name.includes('Al Jazeera') || feed.name.includes('Guardian') || 
               feed.name.includes('Deutsche Welle') || feed.name.includes('Times of India')) {
      category = 'International';
    }
    
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(feed);
    return groups;
  }, {} as Record<string, RssFeed[]>);

  // Toggle all RSS feeds
  const toggleAllRssFeeds = (enabled: boolean) => {
    rssFeeds.forEach(feed => {
      feed.toggleEnabled(enabled);
    });
  };

  if (!visible) return null;

  return (
    <>
      <div className={`api-debug-panel ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="api-debug-header" onClick={() => setExpanded(!expanded)}>
          <h3>API Debug {expanded ? '▼' : '▲'} {enabledCount === 0 ? '(No APIs enabled)' : `(${enabledCount} enabled)`}</h3>
        </div>
        
        {expanded && (
          <div className="api-debug-content">
            <div className="api-debug-actions">
              <button 
                className="test-all-button" 
                onClick={testAllApis}
                disabled={isTesting}
              >
                {isTesting ? 'Testing...' : 'Test All APIs'}
              </button>
              <button 
                className="refresh-button"
                onClick={() => {
                  const event = new CustomEvent(API_SOURCE_CHANGE_EVENT);
                  window.dispatchEvent(event);
                }}
              >
                Refresh Now
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>API</th>
                  <th>Enabled</th>
                  <th>Working</th>
                </tr>
              </thead>
              <tbody>
                {apis.map((api) => (
                  <tr key={api.name}>
                    <td>{api.name}</td>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={api.enabled} 
                        onChange={(e) => api.toggleEnabled(e.target.checked)}
                      />
                    </td>
                    <td>
                      <span className={`status-indicator ${api.working ? 'working' : 'not-working'}`}>
                        {api.working ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* RSS Feeds Configuration */}
            <div className="rss-feeds-section">
              <div 
                className="rss-feeds-header" 
                onClick={toggleRssSection}
              >
                <h4>
                  RSS Feeds 
                  <span className="dropdown-indicator">{rssExpanded ? '▼' : '▲'}</span>
                  <span className="feeds-count">({enabledRssCount}/{totalRssCount} enabled)</span>
                </h4>
              </div>
              
              {rssExpanded && (
                <div className="rss-feeds-content">
                  <div className="rss-actions">
                    <button 
                      className="select-all-button"
                      onClick={() => toggleAllRssFeeds(true)}
                    >
                      Select All
                    </button>
                    <button 
                      className="deselect-all-button"
                      onClick={() => toggleAllRssFeeds(false)}
                    >
                      Deselect All
                    </button>
                  </div>
                  
                  {Object.entries(groupedRssFeeds).map(([category, feeds]) => (
                    <div key={category} className="rss-category">
                      <h5>{category} ({feeds.filter(f => f.enabled).length}/{feeds.length})</h5>
                      <div className="rss-feeds-grid">
                        {feeds.map((feed) => (
                          <div key={feed.name} className="rss-feed-item">
                            <input 
                              type="checkbox" 
                              id={`feed-${feed.name.replace(/\s+/g, '_')}`}
                              checked={feed.enabled} 
                              onChange={(e) => feed.toggleEnabled(e.target.checked)}
                            />
                            <label 
                              htmlFor={`feed-${feed.name.replace(/\s+/g, '_')}`}
                              title={feed.url}
                            >
                              {feed.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Semi-transparent overlay */}
      <div className="debug-panel-overlay" onClick={() => setExpanded(false)}></div>
    </>
  );
};

export default ApiDebugPanel; 