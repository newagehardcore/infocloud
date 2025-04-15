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
  
  useEffect(() => {
    // Animate panel entrance
    setIsVisible(true);
    
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
  }, [onClose]);
  
  const handleClose = () => {
    // Animate panel exit
    setIsVisible(false);
    setTimeout(onClose, 300);
  };
  
  // Get color based on political bias
  const getBiasColor = (bias: string): string => {
    switch (bias) {
      case 'mainstream-left': return '#6495ED'; // Light blue
      case 'alternative-left': return '#00008B'; // Dark blue
      case 'centrist': return '#800080'; // Purple
      case 'mainstream-right': return '#FFB6C1'; // Light red
      case 'alternative-right': return '#FF0000'; // Bright red
      default: return '#808080'; // Gray for unclear
    }
  };
  
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
  
  // Get bias label for display
  const getBiasLabel = (bias: string): string => {
    switch (bias) {
      case 'mainstream-left': return 'Mainstream Left';
      case 'alternative-left': return 'Alternative Left';
      case 'centrist': return 'Centrist';
      case 'mainstream-right': return 'Mainstream Right';
      case 'alternative-right': return 'Alternative Right';
      default: return 'Unclear';
    }
  };
  
  return (
    <div className={`related-news-panel ${isVisible ? 'visible' : ''}`}>
      <div className="panel-header">
        <h2>News related to "{selectedKeyword}"</h2>
        <button className="close-button" onClick={handleClose} aria-label="Close panel">
          ×
        </button>
      </div>
      
      <div className="panel-content">
        {Object.keys(biasGroups).length > 0 ? (
          <div className="bias-groups">
            {Object.entries(biasGroups).map(([bias, items]) => (
              <div key={bias} className="bias-group">
                <h3 className="bias-heading" style={{ color: getBiasColor(bias) }}>
                  {getBiasLabel(bias)} 
                  <span className="source-count">({items.length} sources)</span>
                </h3>
                <ul className="news-list">
                  {items.map(item => (
                    <li key={item.id} className="news-item">
                      <a href={`/news/${item.id}`} className="news-link">
                        <h4 className="news-title">{item.title}</h4>
                        <div className="news-meta">
                          <span className="source-name">{item.source.name}</span>
                          <span className="publish-date">
                            {new Date(item.publishedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-results">No related news found.</p>
        )}
      </div>
      
      <div className="panel-footer">
        <button className="view-all-button" onClick={handleClose}>
          Return to Tag Cloud
        </button>
      </div>
    </div>
  );
};

export default RelatedNewsPanel;
