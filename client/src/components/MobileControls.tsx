import React from 'react';
import { PoliticalBias, SourceType, NewsCategory } from '../types';
import { useFilters } from '../contexts/FilterContext';
import { getSourceTypeFont } from '../utils/fonts';
import './MobileControls.css';

const biasOrder = [
  PoliticalBias.Left,
  PoliticalBias.Liberal,
  PoliticalBias.Centrist,
  PoliticalBias.Conservative,
  PoliticalBias.Right,
  PoliticalBias.Unknown
];

const typeOrder = [SourceType.Independent, SourceType.Corporate, SourceType.State];

const getBiasColor = (bias: PoliticalBias): string => {
  switch (bias) {
    case PoliticalBias.Left: return '#0000FF';
    case PoliticalBias.Liberal: return '#6495ED';
    case PoliticalBias.Centrist: return '#800080';
    case PoliticalBias.Conservative: return '#FFB6C1';
    case PoliticalBias.Right: return '#FF0000';
    case PoliticalBias.Unknown:
    default: return '#808080';
  }
};

const typeLabel = (type: SourceType): string => {
  switch (type) {
    case SourceType.Independent: return 'Independent';
    case SourceType.Corporate: return 'Corporate';
    case SourceType.State: return 'State';
    default: return type;
  }
};

/**
 * Mobile layout: horizontal, swipeable bias/type rows + centered title at
 * the top, horizontal swipeable category row pinned to the bottom. Replaces
 * the desktop Header's vertical lists, which don't fit a phone screen.
 * Native overflow-x scrolling on each row gives finger-swipe for free - no
 * gesture library needed.
 */
const MobileControls: React.FC = () => {
  const {
    enabledBiases, toggleBias,
    enabledTypes, toggleType,
    selectedCategory, setSelectedCategory
  } = useFilters();

  const categories = Object.values(NewsCategory);

  return (
    <>
      <div className="mobile-top-bar">
        <div className="mobile-filter-row">
          {biasOrder.map(bias => (
            <button
              key={bias}
              className={`mobile-filter-button ${enabledBiases.has(bias) ? 'active' : ''}`}
              onClick={() => toggleBias(bias)}
              style={{
                color: enabledBiases.has(bias) ? '#000' : getBiasColor(bias),
                backgroundColor: enabledBiases.has(bias) ? getBiasColor(bias) : 'rgba(0, 0, 0, 0.7)'
              }}
            >
              {bias}
            </button>
          ))}
        </div>
        <div className="mobile-filter-row">
          {typeOrder.map(type => (
            <button
              key={type}
              className={`mobile-filter-button ${enabledTypes.has(type) ? 'active' : ''}`}
              onClick={() => toggleType(type)}
              style={{
                fontFamily: getSourceTypeFont(type),
                color: enabledTypes.has(type) ? '#000' : '#fff',
                backgroundColor: enabledTypes.has(type) ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)'
              }}
            >
              {typeLabel(type)}
            </button>
          ))}
        </div>
        <div className="mobile-title">INFOCLOUD</div>
      </div>

      <div className="mobile-category-bar">
        <div className="mobile-filter-row">
          <button
            className={`mobile-filter-button ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            ALL
          </button>
          {categories.map(category => (
            <button
              key={category}
              className={`mobile-filter-button ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default MobileControls;
