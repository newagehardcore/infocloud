import React from 'react';
import { NewsCategory } from '../types';
import './Header.css';

interface HeaderProps {
  selectedCategory: NewsCategory;
  onCategoryChange: (category: NewsCategory) => void;
}

const Header: React.FC<HeaderProps> = ({ selectedCategory, onCategoryChange }) => {
  const categories = [
    { value: NewsCategory.All, label: 'All' },
    { value: NewsCategory.World, label: 'World' },
    { value: NewsCategory.US, label: 'US' },
    { value: NewsCategory.Tech, label: 'Tech' },
    { value: NewsCategory.Business, label: 'Business' },
    { value: NewsCategory.Entertainment, label: 'Entertainment' },
    { value: NewsCategory.Sports, label: 'Sports' },
    { value: NewsCategory.Health, label: 'Health' },
    { value: NewsCategory.Science, label: 'Science' },
  ];

  return (
    <header className="header">
      <div className="logo">
        <h1>INFOCLOUD</h1>
        <p className="tagline">Real-time News Tag Cloud</p>
      </div>
      <nav className="category-nav">
        <ul>
          {categories.map((category) => (
            <li key={category.value}>
              <label className="category-checkbox">
                <input
                  type="radio"
                  name="category"
                  checked={selectedCategory === category.value}
                  onChange={() => onCategoryChange(category.value)}
                />
                <span className="category-label">{category.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
};

export default Header;
