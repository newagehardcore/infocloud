import React from 'react';
import { NewsCategory, PoliticalBias } from '../types';
import { useFilters } from '../contexts/FilterContext';
import './Header.css';

interface HeaderProps {
  selectedCategory: NewsCategory | 'all';
  onSelectCategory: (category: NewsCategory | 'all') => void;
  currentCategory: NewsCategory | 'all';
}

const Header: React.FC<HeaderProps> = ({ selectedCategory, onSelectCategory }) => {
  const { enabledBiases, toggleBias } = useFilters();
  const categories = Object.values(NewsCategory);
  
  const biasOrder = [
    PoliticalBias.Left,
    PoliticalBias.Liberal,
    PoliticalBias.Centrist,
    PoliticalBias.Conservative,
    PoliticalBias.Right,
    PoliticalBias.Unknown,
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
        <ul className="bias-list-vertical">
          {biasOrder.map(bias => (
            <li key={bias}>
              <button
                className={`category-button ${enabledBiases.has(bias) ? 'active' : ''}`}
                onClick={() => toggleBias(bias)}
                style={{
                  color: enabledBiases.has(bias) ? '#000' : getBiasColor(bias),
                  backgroundColor: enabledBiases.has(bias) ? getBiasColor(bias) : 'rgba(0, 0, 0, 0.7)',
                  margin: '2px 0',
                  width: '100%',
                }}
              >
                {bias}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
};

export default Header;
