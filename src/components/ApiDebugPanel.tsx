import React, { useState } from 'react';
import './ApiDebugPanel.css';
import { useFilters } from '../contexts/FilterContext';
import { PoliticalBias } from '../types';

interface ApiDebugPanelProps {
  visible: boolean;
}

// Create a custom event type for API source changes
export const API_SOURCE_CHANGE_EVENT = 'api-source-change';
export const RSS_FEED_TOGGLE_EVENT = 'rss-feed-toggle';

const ApiDebugPanel: React.FC<ApiDebugPanelProps> = ({ visible }) => {
  const [expanded, setExpanded] = useState(false);
  const [rssExpanded, setRssExpanded] = useState(false);
  
  // Get filter state from context
  const { 
    enabledBiases,
    toggleBias,
    apiSources, 
    toggleApiSource, 
    rssFeeds, 
    toggleRssFeed,
    toggleAllRssFeeds,
    testAllApis,
    isTesting
  } = useFilters();

  // Toggle the RSS feeds section
  const toggleRssSection = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the event from bubbling up to the main panel
    setRssExpanded(!rssExpanded);
  };

  // Count how many APIs are enabled
  const enabledCount = apiSources.filter(api => api.enabled).length;
  
  // Get RSS feed info for display
  const enabledRssCount = rssFeeds.filter(feed => feed.enabled).length;
  const totalRssCount = rssFeeds.length;

  // Bias category labels for grouping
  const biasLabels: { [key in PoliticalBias]?: string } = {
    [PoliticalBias.MainstreamDemocrat]: 'Mainstream Democrat',
    [PoliticalBias.AlternativeLeft]: 'Alternative Left',
    [PoliticalBias.Centrist]: 'Centrist',
    [PoliticalBias.MainstreamRepublican]: 'Mainstream Republican',
    [PoliticalBias.AlternativeRight]: 'Alternative Right',
    [PoliticalBias.Unclear]: 'Unclear'
  };

  // Create an array of bias entries for consistent mapping and correct order
  const biasEntries = [
    { value: PoliticalBias.MainstreamDemocrat, label: biasLabels[PoliticalBias.MainstreamDemocrat]! },
    { value: PoliticalBias.AlternativeLeft, label: biasLabels[PoliticalBias.AlternativeLeft]! },
    { value: PoliticalBias.Centrist, label: biasLabels[PoliticalBias.Centrist]! },
    { value: PoliticalBias.MainstreamRepublican, label: biasLabels[PoliticalBias.MainstreamRepublican]! },
    { value: PoliticalBias.AlternativeRight, label: biasLabels[PoliticalBias.AlternativeRight]! },
    { value: PoliticalBias.Unclear, label: biasLabels[PoliticalBias.Unclear]! },
  ];

  // Group RSS feeds by category
  const groupedRssFeeds = rssFeeds.reduce((groups, feed) => {
    // Extract category from feed entry position in the array
    let category = 'Uncategorized';
    
    if (feed.name.includes('New York Times') || feed.name.includes('Washington Post') || 
        feed.name.includes('NPR') || feed.name.includes('Vox') || 
        feed.name.includes('Vanity Fair') || feed.name.includes('New Yorker')) {
      category = 'Mainstream Left';
    } else if (feed.name.includes('Mother Jones') || 
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
  }, {} as Record<string, typeof rssFeeds[0][]>);

  if (!visible) return null;

  return (
    <>
      <div className={`api-debug-panel ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="api-debug-header" onClick={() => setExpanded(!expanded)}>
          <h3>API Debug {expanded ? '▼' : '▲'} {enabledCount === 0 ? '(No APIs enabled)' : `(${enabledCount} enabled)`}</h3>
        </div>
        
        {expanded && (
          <div className="api-debug-content">
            {/* Bias Filters Section */}
            <div className="menu-section bias-filters">
              <h4>Political Bias Filters</h4>
              <div className="checkbox-group">
                {biasEntries.map(({ value, label }) => (
                  <div key={value} className="checkbox-item">
                    <input 
                      type="checkbox" 
                      id={`debug-bias-${value}`}
                      checked={enabledBiases.has(value)}
                      onChange={() => toggleBias(value)}
                    />
                    <label htmlFor={`debug-bias-${value}`}>{label}</label>
                  </div>
                ))}
              </div>
            </div>
            
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
                {apiSources.map((api) => (
                  <tr key={api.name}>
                    <td>{api.name}</td>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={api.enabled} 
                        onChange={() => toggleApiSource(api.name)}
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
                              id={`debug-feed-${feed.name.replace(/\s+/g, '_')}`}
                              checked={feed.enabled} 
                              onChange={() => toggleRssFeed(feed.name)}
                            />
                            <label 
                              htmlFor={`debug-feed-${feed.name.replace(/\s+/g, '_')}`}
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