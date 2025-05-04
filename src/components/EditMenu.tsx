import React, { useState, useEffect, useRef } from 'react';
import { PoliticalBias, NewsCategory } from '../types';
import { useFilters } from '../contexts/FilterContext';
import './EditMenu.css';

interface EditMenuProps {
  onClose: () => void;
}

const EditMenu: React.FC<EditMenuProps> = ({ onClose }) => {
  const { 
    enabledBiases, 
    toggleBias, 
    selectedCategory,
    setSelectedCategory,
    rssFeeds, 
    toggleRssFeed 
  } = useFilters();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [show24HourFilter, setShow24HourFilter] = useState(() => {
    const saved = localStorage.getItem('show_24hour_filter');
    return saved ? saved === 'true' : false;
  });

  // Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const handleBiasChange = (bias: PoliticalBias) => {
    toggleBias(bias);
  };

  const handleCategoryChange = (category: NewsCategory | 'all') => {
    setSelectedCategory(category);
  };

  const handle24HourToggle = () => {
    const newValue = !show24HourFilter;
    setShow24HourFilter(newValue);
    localStorage.setItem('show_24hour_filter', newValue.toString());
    // Dispatch custom event for App.tsx to handle
    window.dispatchEvent(new CustomEvent('time_filter_change', { detail: { enabled: newValue } }));
  };

  const getBiasColor = (bias: PoliticalBias): string => {
    switch (bias) {
      case PoliticalBias.Left:
        return '#FF69B4'; // Hot Pink
      case PoliticalBias.Liberal:
        return '#6495ED'; // Cornflower Blue
      case PoliticalBias.Centrist:
        return '#98FB98'; // Pale Green
      case PoliticalBias.Unknown:
        return '#DDD'; // Light Gray
      case PoliticalBias.Conservative:
        return '#DDA0DD'; // Plum
      case PoliticalBias.Right:
        return '#FF6B6B'; // Light Red
      default:
        return '#FFF';
    }
  };

  const biasOrder: PoliticalBias[] = [
    PoliticalBias.Left,
    PoliticalBias.Liberal,
    PoliticalBias.Centrist,
    PoliticalBias.Unknown,
    PoliticalBias.Conservative,
    PoliticalBias.Right,
  ];

  const biasLabels: { [key in PoliticalBias]: string } = {
    [PoliticalBias.Left]: 'Alternative Left',
    [PoliticalBias.Liberal]: 'Mainstream Democrat',
    [PoliticalBias.Centrist]: 'Centrist',
    [PoliticalBias.Unknown]: 'Unclear',
    [PoliticalBias.Conservative]: 'Mainstream Republican',
    [PoliticalBias.Right]: 'Alternative Right',
  };

  const categories: (NewsCategory | 'all')[] = ['all', ...Object.values(NewsCategory)];

  return (
    <div className={`edit-menu ${isOpen ? 'open' : ''}`} ref={menuRef}>
      <div className="edit-menu-buttons">
        <button className="edit-menu-toggle" onClick={handleToggle} aria-label="Toggle filters menu">
          <span className="icon">⚙️</span>
        </button>
        <button 
          className={`edit-menu-toggle time-filter ${show24HourFilter ? 'active' : ''}`} 
          onClick={handle24HourToggle} 
          aria-label="Toggle 24-hour filter"
        >
          <span className="icon">🕐</span>
        </button>
      </div>
      <div className="edit-menu-content">
        <button className="close-button" onClick={handleClose} aria-label="Close filters menu">✕</button>
        <h3>Filters & Settings</h3>
        
        {/* Category Filter */}
        <div className="menu-section category-filters">
          <h4>Filter by Category</h4>
          <div className="button-group">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-button ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat === 'all' ? 'All Categories' : cat} 
              </button>
            ))}
          </div>
        </div>
        
        {/* Bias Filters */}
        <div className="menu-section bias-filters">
          <h4>Filter by Political Bias</h4>
          <div className="checkbox-group">
            {biasOrder.map((bias) => (
              <div key={bias} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`bias-${bias}`}
                  checked={enabledBiases.has(bias)}
                  onChange={() => handleBiasChange(bias)}
                />
                <label 
                  htmlFor={`bias-${bias}`}
                  style={{ color: getBiasColor(bias) }}
                >
                  {biasLabels[bias]}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Time Filter */}
        <div className="menu-section time-filter">
          <h4>Time Filter</h4>
          <div className="checkbox-group">
            <div className="checkbox-item">
              <input
                type="checkbox"
                id="24-hour-filter"
                checked={show24HourFilter}
                onChange={handle24HourToggle}
              />
              <label htmlFor="24-hour-filter">
                Last 24 Hours Only
              </label>
            </div>
          </div>
        </div>

        {/* RSS Feed Toggles */}
        <div className="menu-section rss-feeds">
          <h4>RSS Feed Sources</h4>
          {rssFeeds && rssFeeds.length > 0 ? (
            <p>Feed toggles will be available soon</p>
          ) : (
            <p>Loading feed sources...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditMenu; 