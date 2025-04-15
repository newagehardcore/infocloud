import React from 'react';
import { NewsCategory } from '../types';
import EditMenu from './EditMenu';
import './Header.css';

interface HeaderProps {
  selectedCategory: NewsCategory;
  onSelectCategory: (category: NewsCategory) => void;
}

const Header: React.FC<HeaderProps> = ({ selectedCategory, onSelectCategory }) => {
  const categories = Object.values(NewsCategory);

  return (
    <header className="header">
      <div className="logo">
        <span className="logo-text">INFOCLOUD</span>
      </div>
      <div className="category-buttons">
        {categories.map(category => (
          <button
            key={category}
            className={`category-button ${selectedCategory === category ? 'selected' : ''}`}
            onClick={() => onSelectCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <EditMenu onClose={() => {}} />
    </header>
  );
};

export default Header;
