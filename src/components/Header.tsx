import React from 'react';
import { NewsCategory } from '../types';
import EditMenu from './EditMenu';
import './Header.css';

interface HeaderProps {
  selectedCategory: NewsCategory;
  onSelectCategory: (category: NewsCategory) => void;
  currentCategory: NewsCategory;
}

const Header: React.FC<HeaderProps> = ({ selectedCategory, onSelectCategory }) => {
  const categories = Object.values(NewsCategory);

  return (
    <header className="header">
      <div className="logo">
        <span className="logo-text">INFOCLOUD</span>
      </div>
      <nav className="category-nav">
        <ul>
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
