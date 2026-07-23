import React from 'react';
import { NewsCategory, PoliticalBias, SourceType } from '../types';
import { useFilters } from '../contexts/FilterContext';
import { getSourceTypeFont } from '../utils/fonts';
import './Header.css';

interface HeaderProps {
  selectedCategory: NewsCategory | 'all';
  onSelectCategory: (category: NewsCategory | 'all') => void;
  currentCategory: NewsCategory | 'all';
}

const Header: React.FC<HeaderProps> = ({ selectedCategory, onSelectCategory }) => {
  const { enabledBiases, toggleBias, enabledTypes, toggleType } = useFilters();
  const categories = Object.values(NewsCategory);

  const typeOrder = [
    SourceType.Independent,
    SourceType.Corporate,
    SourceType.State,
  ];

  const typeLabel = (type: SourceType): string => {
    switch (type) {
      case SourceType.Independent: return 'Independent';
      case SourceType.Corporate: return 'Corporate';
      case SourceType.State: return 'State';
      default: return type;
    }
  };
  
  // Unknown bias has no visible toggle: real word data virtually never
  // resolves to it (a word only lands there if BOTH the source's bias and
  // the LLM's per-article guess are missing), so the button was effectively
  // inert - toggling it never visibly changed anything.
  const biasOrder = [
    PoliticalBias.Left,
    PoliticalBias.Liberal,
    PoliticalBias.Centrist,
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
        <ul className="bias-list-vertical">
          {biasOrder.map(bias => (
            <li key={bias}>
              <button
                className={`category-button ${enabledBiases.has(bias) ? 'active' : ''}`}
                onClick={(e) => toggleBias(bias, e)}
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
        <ul className="type-list-vertical">
          {typeOrder.map(type => (
            <li key={type}>
              <button
                className={`category-button type-button ${enabledTypes.has(type) ? 'active' : ''}`}
                onClick={(e) => toggleType(type, e)}
                style={{
                  fontFamily: getSourceTypeFont(type),
                  color: enabledTypes.has(type) ? '#000' : '#fff',
                  backgroundColor: enabledTypes.has(type) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)',
                  margin: '2px 0',
                  width: '100%',
                }}
              >
                {typeLabel(type)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
};

export default Header;
