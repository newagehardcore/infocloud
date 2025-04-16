import React, { useState, useEffect } from 'react';
import { PoliticalBias } from '../types';
import { useFilters } from '../contexts/FilterContext';
import './EditMenu.css';
import { DEFAULT_RSS_FEEDS } from '../services/newsService';
import { RssFeedConfig } from '../types';

interface EditMenuProps {
  onClose: () => void; // Called when menu closes
}

const EditMenu: React.FC<EditMenuProps> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
  const [isApiSourcesOpen, setIsApiSourcesOpen] = useState(false);
  const [isRssFeedsOpen, setIsRssFeedsOpen] = useState(false);
  
  // Get filter state from context
  const { 
    enabledBiases, 
    toggleBias, 
    apiSources, 
    toggleApiSource, 
    rssFeeds, 
    toggleRssFeed
  } = useFilters();

  const toggleMenu = () => {
    if (isOpen) {
      // Just close the menu, no need to save state or trigger refresh
      // since we're handling updates in real-time
      onClose();
    }
    setIsOpen(!isOpen);
  };

  // Bias category labels
  const biasLabels: { [key in PoliticalBias]?: string } = {
    [PoliticalBias.MainstreamDemocrat]: 'Mainstream Democrat',
    [PoliticalBias.AlternativeLeft]: 'Alternative Left',
    [PoliticalBias.Centrist]: 'Centrist',
    [PoliticalBias.MainstreamRepublican]: 'Mainstream Republican',
    [PoliticalBias.AlternativeRight]: 'Alternative Right',
    [PoliticalBias.Unclear]: 'Unclear'
  };

  // Create an array of bias entries for the requested order
  const biasEntries = [
    { value: PoliticalBias.AlternativeLeft, label: biasLabels[PoliticalBias.AlternativeLeft]! },
    { value: PoliticalBias.MainstreamDemocrat, label: biasLabels[PoliticalBias.MainstreamDemocrat]! },
    { value: PoliticalBias.Centrist, label: biasLabels[PoliticalBias.Centrist]! },
    { value: PoliticalBias.Unclear, label: biasLabels[PoliticalBias.Unclear]! },
    { value: PoliticalBias.MainstreamRepublican, label: biasLabels[PoliticalBias.MainstreamRepublican]! },
    { value: PoliticalBias.AlternativeRight, label: biasLabels[PoliticalBias.AlternativeRight]! },
  ];

  // Bias order and labels for RSS grouping
  const rssBiasOrder: PoliticalBias[] = [
    PoliticalBias.AlternativeLeft,
    PoliticalBias.MainstreamDemocrat,
    PoliticalBias.Centrist,
    PoliticalBias.Unclear,
    PoliticalBias.MainstreamRepublican,
    PoliticalBias.AlternativeRight,
  ];
  const rssBiasLabels: { [key in PoliticalBias]: string } = {
    [PoliticalBias.AlternativeLeft]: 'Alternative Left',
    [PoliticalBias.MainstreamDemocrat]: 'Mainstream Democrat',
    [PoliticalBias.Centrist]: 'Centrist',
    [PoliticalBias.Unclear]: 'Unclear',
    [PoliticalBias.MainstreamRepublican]: 'Mainstream Republican',
    [PoliticalBias.AlternativeRight]: 'Alternative Right',
  };

  // Group RSS feeds by bias
  const rssFeedsByBias: { [key in PoliticalBias]: typeof rssFeeds } = {
    [PoliticalBias.AlternativeLeft]: [],
    [PoliticalBias.MainstreamDemocrat]: [],
    [PoliticalBias.Centrist]: [],
    [PoliticalBias.Unclear]: [],
    [PoliticalBias.MainstreamRepublican]: [],
    [PoliticalBias.AlternativeRight]: [],
  };
  rssFeeds.forEach(feed => {
    // Find the feed config in DEFAULT_RSS_FEEDS to get its bias
    const config = DEFAULT_RSS_FEEDS.find((f: RssFeedConfig) => f.name === feed.name);
    const bias = (config?.bias || PoliticalBias.Unclear) as PoliticalBias;
    rssFeedsByBias[bias].push(feed);
  });

  // Helper to check if all feeds in a group are enabled
  const isGroupEnabled = (feeds: typeof rssFeeds) => feeds.length > 0 && feeds.every(f => f.enabled);
  // Helper to check if some feeds in a group are enabled
  const isGroupIndeterminate = (feeds: typeof rssFeeds) => feeds.some(f => f.enabled) && !isGroupEnabled(feeds);

  // Handler to toggle all feeds in a group
  const toggleRssFeedGroup = (feeds: typeof rssFeeds, enabled: boolean) => {
    feeds.forEach(feed => {
      if (feed.enabled !== enabled) toggleRssFeed(feed.name);
    });
  };

  // Handler to toggle a political bias and set all RSS feeds for that bias to the new state
  const handleToggleBias = (bias: PoliticalBias) => {
    const willEnable = !enabledBiases.has(bias);
    toggleBias(bias);
    // Set all RSS feeds for this bias to the new state (always use current rssFeeds)
    rssFeeds
      .filter(feed => {
        const config = DEFAULT_RSS_FEEDS.find((f: RssFeedConfig) => f.name === feed.name);
        const feedBias = (config?.bias || PoliticalBias.Unclear) as PoliticalBias;
        return feedBias === bias;
      })
      .forEach(feed => {
        if (feed.enabled !== willEnable) toggleRssFeed(feed.name);
      });
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
            <div className="menu-section bias-section">
              <h4>Filter by Political Bias</h4>
              <div className="bias-checkbox-group">
                {biasEntries.map(({ value, label }) => (
                  <div key={value} className="checkbox-item">
                    <input
                      type="checkbox"
                      id={`bias-${value}`}
                      checked={enabledBiases.has(value)}
                      onChange={() => handleToggleBias(value)}
                    />
                    <label htmlFor={`bias-${value}`}>{label}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="divider" />

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
                      {apiSources.map(api => (
                        <div key={api.name} className="checkbox-item">
                          <input
                            type="checkbox"
                            id={`edit-api-${api.name}`}
                            checked={api.enabled}
                            onChange={() => toggleApiSource(api.name)}
                          />
                          <label htmlFor={`edit-api-${api.name}`}>
                            {api.name}
                            <span className={`status-dot ${api.working ? 'working' : 'not-working'}`} />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RSS FEEDS Section */}
                  <div className="menu-section rss-section">
                    <h4>RSS FEEDS</h4>
                    {rssBiasOrder.map(bias => {
                      const feeds = rssFeedsByBias[bias];
                      if (!feeds.length) return null;
                      const allEnabled = isGroupEnabled(feeds);
                      const indeterminate = isGroupIndeterminate(feeds);
                      return (
                        <div key={bias} className="rss-bias-group">
                          <div className="rss-bias-header">
                            <input
                              type="checkbox"
                              checked={allEnabled}
                              ref={el => { if (el) el.indeterminate = indeterminate; }}
                              onChange={e => toggleRssFeedGroup(feeds, !allEnabled)}
                              style={{ marginRight: 6, accentColor: '#888', width: 15, height: 15 }}
                            />
                            <span>{rssBiasLabels[bias]}</span>
                          </div>
                          <div className="rss-checkbox-group">
                            {feeds.map(feed => (
                              <div key={feed.name} className="checkbox-item">
                                <input
                                  type="checkbox"
                                  id={`rss-${feed.name}`}
                                  checked={feed.enabled}
                                  onChange={() => toggleRssFeed(feed.name)}
                                />
                                <label htmlFor={`rss-${feed.name}`}>{feed.name}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditMenu; 