import React from 'react';
import { NewsCategory } from '../types';
import './Header.css';

interface HeaderProps {
  selectedCategory: NewsCategory;
  onCategoryChange: (category: NewsCategory) => void;
}

const Header: React.FC<HeaderProps> = ({ selectedCategory, onCategoryChange }) => {
  const categories = [
    // Main
    { value: NewsCategory.All, label: 'All' },
    
    // News & Politics
    { value: NewsCategory.US, label: 'US' },
    { value: NewsCategory.World, label: 'World' },
    { value: NewsCategory.Politics, label: 'Politics' },
    { value: NewsCategory.Military, label: 'Military' },
    { value: NewsCategory.Crime, label: 'Crime' },
    
    // Science & Tech
    { value: NewsCategory.Tech, label: 'Tech' },
    { value: NewsCategory.AI, label: 'AI' },
    { value: NewsCategory.Science, label: 'Science' },
    { value: NewsCategory.Space, label: 'Space' },
    
    // Economy
    { value: NewsCategory.Business, label: 'Business' },
    { value: NewsCategory.Finance, label: 'Finance' },
    
    // Society
    { value: NewsCategory.Health, label: 'Health' },
    { value: NewsCategory.Education, label: 'Education' },
    { value: NewsCategory.Environment, label: 'Environment' },
    
    // Culture
    { value: NewsCategory.Entertainment, label: 'Entertainment' },
    { value: NewsCategory.Art, label: 'Art' },
    { value: NewsCategory.Sports, label: 'Sports' }
  ];

  return (
    <header className="header">
      <div className="logo">
        <h1>INFOCLOUD</h1>
      </div>
      <nav className="category-nav">
        <ul>
          {categories.map((category) => (
            <li key={category.value}>
              <button
                className={`category-button ${selectedCategory === category.value ? 'active' : ''}`}
                onClick={() => onCategoryChange(category.value)}
                aria-pressed={selectedCategory === category.value}
              >
                {category.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
};

export default Header;
