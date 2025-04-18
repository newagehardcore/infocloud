import React, { useState, useEffect } from 'react';
import { NewsItem } from '../types';
import './RelatedNewsPanel.css';

interface RelatedNewsPanelProps {
  newsItems: NewsItem[];
  selectedKeyword: string;
  onClose: () => void;
}

const RelatedNewsPanel: React.FC<RelatedNewsPanelProps> = ({
  newsItems,
  selectedKeyword,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [expandedBiases, setExpandedBiases] = useState<{[key: string]: boolean}>({});
  
  useEffect(() => {
    // Animate panel entrance
    setIsVisible(true);
    
    // Initialize all bias groups as expanded
    const initialExpandedState: {[key: string]: boolean} = {};
    newsItems.forEach(item => {
      initialExpandedState[item.source.bias] = true;
    });
    setExpandedBiases(initialExpandedState);
    
    // Add escape key listener to close panel
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscKey);
    
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose, newsItems]);
  
  const handleClose = () => {
    // Animate panel exit
    setIsVisible(false);
    setTimeout(onClose, 300);
  };
  
  // Toggle collapse/expand for a bias group
  const toggleBiasExpand = (bias: string) => {
    setExpandedBiases(prev => ({
      ...prev,
      [bias]: !prev[bias]
    }));
  };
  
  // Define the desired order for bias groups
  const biasOrder = [
    'Left',
    'Liberal',
    'Centrist',
    'Unknown',
    'Conservative',
    'Right'
  ];

  // Group news items by source bias
  const groupByBias = () => {
    const groups: { [key: string]: NewsItem[] } = {};
    newsItems.forEach(item => {
      const bias = item.source.bias;
      if (!groups[bias]) {
        groups[bias] = [];
      }
      groups[bias].push(item);
    });
    return groups;
  };

  const biasGroups = groupByBias();

  // Get bias groups in the desired order
  const orderedBiasGroups = biasOrder
    .map(bias => [bias, biasGroups[bias]] as [string, NewsItem[]])
    .filter(([, items]) => items && items.length > 0);
  
  // Get bias label for display
  const getBiasLabel = (bias: string): string => {
    switch (bias) {
      case 'Left': return 'Left';
      case 'Liberal': return 'Liberal';
      case 'Centrist': return 'Centrist';
      case 'Conservative': return 'Conservative';
      case 'Right': return 'Right';
      case 'Unknown':
      default: return 'Unknown';
    }
  };

  // Get color based on political bias
  const getBiasColor = (bias: string): string => {
    switch (bias) {
      case 'Left': return '#0000FF'; // Bright blue
      case 'Liberal': return '#6495ED'; // Light blue
      case 'Centrist': return '#800080'; // Purple
      case 'Conservative': return '#FFB6C1'; // Light red
      case 'Right': return '#FF0000'; // Bright red
      case 'Unknown':
      default: return '#808080'; // Gray for unclear
    }
  };

  return (
    <>
      <div className={`backdrop-overlay ${isVisible ? 'visible' : ''}`} onClick={handleClose}></div>
      <div className={`related-news-panel ${isVisible ? 'visible' : ''}`}>
        <div className="panel-header">
          <h2>News related to "{selectedKeyword}"</h2>
          <button className="close-button" onClick={handleClose} aria-label="Close panel">
            ×
          </button>
        </div>
        
        <div className="panel-content">
          {newsItems.length === 0 ? (
            <div className="no-results">
              <p>No related news found for "{selectedKeyword}"</p>
              <p className="error-note">This is unexpected - please report this issue as every word should have at least one related news item.</p>
            </div>
          ) : (
            <>
              <div className="news-summary">
                Found {newsItems.length} articles containing "{selectedKeyword}"
              </div>
              <div className="bias-groups">
                {orderedBiasGroups.map(([bias, items]) => (
                  <div key={bias} className="bias-group">
                    <h3 
                      className="bias-heading" 
                      style={{ color: getBiasColor(bias) }}
                      onClick={() => toggleBiasExpand(bias)}
                    >
                      {getBiasLabel(bias)} 
                      <span className="source-count">({items.length} sources)</span>
                      <span className="accordion-icon">
                        {expandedBiases[bias] ? '▾' : '▸'}
                      </span>
                    </h3>
                    {expandedBiases[bias] && (
                      <ul className="news-list">
                        {items.map((item, index) => (
                          <li key={`${item.id}-${index}`} className="news-item">
                            <a href={item.url} className="news-link" target="_blank" rel="noopener noreferrer">
                              <h4 className="news-title">{item.title}</h4>
                              <div className="news-meta">
                                <span className="source-name">{item.source.name}</span>
                                <span className="publish-date">
                                  {new Date(item.publishedAt).toLocaleString()}
                                </span>
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        
        <div className="panel-footer">
          <button className="view-all-button" onClick={handleClose}>
            Return to Tag Cloud
          </button>
        </div>
      </div>
    </>
  );
};

export default RelatedNewsPanel;
