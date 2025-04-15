import React, { useState, useEffect } from 'react';
import { PoliticalBias } from '../types';
import { DEFAULT_RSS_FEEDS } from '../services/newsService';
import { BIAS_UPDATE_EVENT } from '../App';
import './EditMenu.css';

interface ApiStatus {
  name: string;
  enabled: boolean;
  working: boolean;
}

interface RssFeed {
  name: string;
  url: string;
  enabled: boolean;
}

interface EditMenuProps {
  onClose: () => void; // Called when menu closes
}

const EditMenu: React.FC<EditMenuProps> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
  const [enabledBiases, setEnabledBiases] = useState<Set<PoliticalBias>>(new Set(Object.values(PoliticalBias)));
  const [apis, setApis] = useState<ApiStatus[]>([
    { name: 'NewsAPI', enabled: false, working: false },
    { name: 'GNews', enabled: false, working: false },
    { name: 'TheNewsAPI', enabled: false, working: false },
    { name: 'RSS', enabled: true, working: false }
  ]);
  const [rssFeeds, setRssFeeds] = useState<RssFeed[]>([]);
  const [isApiSourcesOpen, setIsApiSourcesOpen] = useState(false);
  const [isRssFeedsOpen, setIsRssFeedsOpen] = useState(false);

  // Load saved state on mount
  useEffect(() => {
    // Load bias filters
    const savedBiases = localStorage.getItem('enabled_biases');
    if (savedBiases) {
      setEnabledBiases(new Set(JSON.parse(savedBiases) as PoliticalBias[]));
    }

    // Load API states
    apis.forEach(api => {
      const savedState = localStorage.getItem(`api_${api.name.replace(/\s+/g, '')}_enabled`);
      if (savedState !== null) {
        setApis(prev => prev.map(a => 
          a.name === api.name ? { ...a, enabled: savedState === 'true' } : a
        ));
      }
    });

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

  const toggleMenu = () => {
    if (isOpen) {
      // Just close the menu, no need to save state or trigger refresh
      // since we're handling updates in real-time
      onClose();
    }
    setIsOpen(!isOpen);
  };

  const handleBiasToggle = (bias: PoliticalBias) => {
    const newEnabledBiases = new Set(enabledBiases);
    if (newEnabledBiases.has(bias)) {
      newEnabledBiases.delete(bias);
    } else {
      newEnabledBiases.add(bias);
    }
    setEnabledBiases(newEnabledBiases);
    
    // Save to localStorage
    localStorage.setItem('enabled_biases', JSON.stringify(Array.from(newEnabledBiases)));
    
    // Dispatch event for real-time updates
    window.dispatchEvent(new Event(BIAS_UPDATE_EVENT));
  };

  const toggleApi = (apiName: string) => {
    setApis(prev => prev.map(api => 
      api.name === apiName ? { ...api, enabled: !api.enabled } : api
    ));
  };

  const toggleRssFeed = (feedName: string) => {
    setRssFeeds(prev => prev.map(feed => 
      feed.name === feedName ? { ...feed, enabled: !feed.enabled } : feed
    ));
  };

  // Bias category labels
  const biasLabels: { [key in PoliticalBias]?: string } = {
    [PoliticalBias.MainstreamLeft]: 'Mainstream Left',
    [PoliticalBias.AlternativeLeft]: 'Alternative Left',
    [PoliticalBias.Centrist]: 'Centrist',
    [PoliticalBias.MainstreamRight]: 'Mainstream Right',
    [PoliticalBias.AlternativeRight]: 'Alternative Right',
    [PoliticalBias.Unclear]: 'Unclear'
  };

  return (
    <div className="edit-menu-container">
      <button className="edit-menu-button" onClick={toggleMenu}>
        Edit
      </button>

      {isOpen && (
        <div className="edit-menu-dropdown">
          <div className="edit-menu-header">
            <span>Edit View</span>
            <button className="close-menu-button" onClick={toggleMenu}>×</button>
          </div>
          <div className="edit-menu-content">
            {/* Bias Filters Section */}
            <div className="menu-section">
              <h4>Filter by Political Bias</h4>
              <div className="checkbox-group">
                {(Object.keys(biasLabels) as PoliticalBias[]).map(bias => (
                  <div key={bias} className="checkbox-item">
                    <input 
                      type="checkbox" 
                      id={`bias-${bias}`}
                      checked={enabledBiases.has(bias)}
                      onChange={() => handleBiasToggle(bias)}
                    />
                    <label htmlFor={`bias-${bias}`}>{biasLabels[bias]}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* News Sources Accordion Section */}
            <div className="menu-section">
              <button 
                className="accordion-header"
                onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
              >
                <h4>News Sources</h4>
                <span className="accordion-icon">{isSourcesExpanded ? '▼' : '▲'}</span>
              </button>
              
              {isSourcesExpanded && (
                <div className="accordion-content">
                  {/* API Sources */}
                  <div className="source-group">
                    <h5>API Sources</h5>
                    <div className="checkbox-group">
                      {apis.map(api => (
                        <div key={api.name} className="checkbox-item">
                          <input
                            type="checkbox"
                            id={`api-${api.name}`}
                            checked={api.enabled}
                            onChange={() => toggleApi(api.name)}
                          />
                          <label htmlFor={`api-${api.name}`}>
                            {api.name}
                            <span className={`status-dot ${api.working ? 'working' : 'not-working'}`} />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RSS Feeds */}
                  <div className="source-group">
                    <h5>RSS Feeds</h5>
                    <div className="checkbox-group">
                      {rssFeeds.map(feed => (
                        <div key={feed.name} className="checkbox-item">
                          <input
                            type="checkbox"
                            id={`feed-${feed.name}`}
                            checked={feed.enabled}
                            onChange={() => toggleRssFeed(feed.name)}
                          />
                          <label 
                            htmlFor={`feed-${feed.name}`}
                            title={feed.url}
                          >
                            {feed.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="menu-section action-buttons">
              <button 
                className="test-button"
                onClick={() => {
                  // TODO: Implement test functionality
                }}
              >
                Test All Sources
              </button>
              <button 
                className="refresh-button"
                onClick={() => {
                  toggleMenu(); // Close menu and trigger refresh
                }}
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditMenu; 