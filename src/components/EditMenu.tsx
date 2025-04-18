import React, { useState, useEffect, useRef } from 'react';
import { PoliticalBias } from '../types';
import { useFilters } from '../contexts/FilterContext';
import './EditMenu.css';

interface EditMenuProps {
  onClose: () => void;
}

const EditMenu: React.FC<EditMenuProps> = ({ onClose }) => {
  const { enabledBiases, toggleBias, rssFeeds, toggleRssFeed } = useFilters();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const getBiasColor = (bias: PoliticalBias): string => {
    switch (bias) {
      case PoliticalBias.Left:
        return '#0000FF'; // Bright blue
      case PoliticalBias.Liberal:
        return '#6495ED'; // Light blue
      case PoliticalBias.Centrist:
        return '#800080'; // Purple
      case PoliticalBias.Conservative:
        return '#FFB6C1'; // Light red
      case PoliticalBias.Right:
        return '#FF0000'; // Bright red
      case PoliticalBias.Unknown:
      default:
        return '#808080'; // Grey
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
    [PoliticalBias.Left]: 'Left',
    [PoliticalBias.Liberal]: 'Liberal',
    [PoliticalBias.Centrist]: 'Centrist',
    [PoliticalBias.Unknown]: 'Unknown',
    [PoliticalBias.Conservative]: 'Conservative',
    [PoliticalBias.Right]: 'Right',
  };

  return (
    <div className={`edit-menu ${isOpen ? 'open' : ''}`} ref={menuRef}>
      <button className="edit-menu-toggle" onClick={handleToggle} aria-label="Toggle filters menu">
        <span className="icon">⚙️</span>
      </button>
      <div className="edit-menu-content">
        <button className="close-button" onClick={handleClose} aria-label="Close filters menu">✕</button>
        <h3>Filters & Settings</h3>
        
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