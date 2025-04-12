import React, { useEffect, useState } from 'react';
import './ApiDebugPanel.css';

interface ApiStatus {
  name: string;
  enabled: boolean;
  working: boolean;
  toggleEnabled: (enabled: boolean) => void;
}

interface ApiDebugPanelProps {
  visible: boolean;
}

// Create a custom event type for API source changes
export const API_SOURCE_CHANGE_EVENT = 'api-source-change';

const ApiDebugPanel: React.FC<ApiDebugPanelProps> = ({ visible }) => {
  const [apis, setApis] = useState<ApiStatus[]>([
    { name: 'NewsAPI', enabled: false, working: false, toggleEnabled: () => {} },
    { name: 'GNews', enabled: false, working: false, toggleEnabled: () => {} },
    { name: 'TheNewsAPI', enabled: false, working: false, toggleEnabled: () => {} }
  ]);
  const [expanded, setExpanded] = useState(false);
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
      }
    ]);
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

  if (!visible) return null;

  return (
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
        </div>
      )}
    </div>
  );
};

export default ApiDebugPanel; 