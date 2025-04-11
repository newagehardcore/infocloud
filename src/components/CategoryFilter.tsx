import React, { useState, useEffect } from 'react';
import { NewsCategory } from '../types';
import './CategoryFilter.css';

interface CategoryFilterProps {
  selectedCategory: NewsCategory;
  onCategoryChange: (category: NewsCategory) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({ 
  selectedCategory, 
  onCategoryChange 
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  
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
  
  const handleCategoryChange = (category: NewsCategory) => {
    if (category !== selectedCategory) {
      setIsAnimating(true);
      onCategoryChange(category);
      
      // Reset animation state after transition completes
      setTimeout(() => {
        setIsAnimating(false);
      }, 1000);
    }
  };
  
  return (
    <div className="category-filter">
      <div className={`filter-container ${isAnimating ? 'animating' : ''}`}>
        {categories.map((category) => (
          <button
            key={category.value}
            className={`category-button ${selectedCategory === category.value ? 'active' : ''}`}
            onClick={() => handleCategoryChange(category.value)}
            aria-pressed={selectedCategory === category.value}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryFilter;
