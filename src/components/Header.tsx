import React from 'react';
import { NewsCategory, PoliticalBias } from '../types';
import { useFilters } from '../contexts/FilterContext';
import EditMenu from './EditMenu';
import './Header.css';

interface HeaderProps {
  selectedCategory: NewsCategory;
  onSelectCategory: (category: NewsCategory) => void;
  currentCategory: NewsCategory;
}

const Header: React.FC<HeaderProps> = ({ selectedCategory, onSelectCategory }) => {
  const { enabledBiases, toggleBias } = useFilters();
  const categories = Object.values(NewsCategory);
  
  const biasOrder = [
    PoliticalBias.Left,
    PoliticalBias.Liberal,
    PoliticalBias.Centrist,
    PoliticalBias.Unknown,
    PoliticalBias.Conservative,
    PoliticalBias.Right,
  ];

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

  return (
    <header className="header">
      <div className="logo">
        <span className="logo-text">INFOCLOUD</span>
      </div>
      <nav className="category-nav">
        <ul>
          {/* Bias Filters */}
          {biasOrder.map(bias => (
            <li key={bias}>
              <button
                className={`category-button ${enabledBiases.has(bias) ? 'active' : ''}`}
                onClick={() => toggleBias(bias)}
                style={{
                  color: enabledBiases.has(bias) ? '#000' : getBiasColor(bias),
                  backgroundColor: enabledBiases.has(bias) ? getBiasColor(bias) : 'rgba(0, 0, 0, 0.7)',
                }}
              >
                {bias}
              </button>
            </li>
          ))}
          {/* Categories */}
          {categories.map(category => (
            <li key={category}>
              <button
                className={`category-button ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => onSelectCategory(category)}
              >
                {category}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="edit-menu">
        <EditMenu onClose={() => {}} />
      </div>
    </header>
  );
};

export default Header;
