import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { NewsItem } from '../types';
import './NewsDetail.css';

const NewsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This useEffect needs to be refactored to fetch a single item from the backend API:
    // e.g., axios.get(`/api/news/${id}`)
    /* Commenting out old logic:
    const fetchItem = async () => {
      setLoading(true);
      setError(null);
      try {
        const allItems = await fetchAllNewsItems(); // This function no longer exists
        const foundItem = allItems.find(newsItem => newsItem.id === id);
        if (foundItem) {
          setItem(foundItem);
        } else {
          setError('News item not found.');
        }
      } catch (err) {
        console.error('Error fetching news item:', err);
        setError('Failed to load news item.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchItem();
    }
    */
    // Placeholder logic:
    console.warn('NewsDetail component needs refactoring to fetch data from API');
    setLoading(false);
    setError('NewsDetail component not yet implemented with backend API.');

  }, [id]);

  if (loading) {
    return <div className="news-detail loading">Loading...</div>;
  }

  if (error || !item) {
    return (
      <div className="news-detail error">
        <p>{error || 'News item not found'}</p>
        <Link to="/" className="back-link">Back to Tag Cloud</Link>
      </div>
    );
  }

  const getBiasLabel = (bias: string) => {
    switch (bias) {
      case 'mainstream-left': return 'Mainstream Left';
      case 'alternative-left': return 'Alternative Left';
      case 'centrist': return 'Centrist';
      case 'mainstream-right': return 'Mainstream Right';
      case 'alternative-right': return 'Alternative Right';
      default: return 'Unclear';
    }
  };

  const getBiasClass = (bias: string) => {
    return `bias-indicator ${bias}`;
  };

  return (
    <div className="news-detail">
      <Link to="/" className="back-link">Back to Tag Cloud</Link>
      
      <article className="news-article">
        <h1>{item.title}</h1>
        
        <div className="news-meta">
          <span className="news-source">
            Source: {item.source.name}
          </span>
          <span className={getBiasClass(item.source.bias)}>
            {getBiasLabel(item.source.bias)}
          </span>
          <span className="news-date">
            {new Date(item.publishedAt).toLocaleString()}
          </span>
          <span className="news-category">
            {item.category}
          </span>
        </div>
        
        <p className="news-description">{item.description}</p>
        
        <div className="news-keywords">
          <h3>Keywords:</h3>
          <div className="keyword-list">
            {item.keywords.map((keyword, index) => (
              <span key={index} className="keyword">{keyword}</span>
            ))}
          </div>
        </div>
        
        <a 
          href={item.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="read-more-link"
        >
          Read full article
        </a>
      </article>
    </div>
  );
};

export default NewsDetail;
