import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { NewsItem } from '../types';
import { fetchAllNewsItems } from '../services/newsService';
import './NewsDetail.css';

const NewsDetail: React.FC = () => {
  const { newsId } = useParams<{ newsId: string }>();
  const [newsItem, setNewsItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNewsDetail = async () => {
      if (!newsId) {
        setError('News ID is missing');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const allNews = await fetchAllNewsItems();
        const item = allNews.find((item: NewsItem) => item.id === newsId);
        
        if (item) {
          setNewsItem(item);
        } else {
          setError('News item not found.');
        }
      } catch (error) {
        console.error('Error loading news detail:', error);
        setError('Failed to load news details.');
      } finally {
        setLoading(false);
      }
    };

    loadNewsDetail();
  }, [newsId]);

  if (loading) {
    return <div className="news-detail loading">Loading...</div>;
  }

  if (error || !newsItem) {
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
        <h1>{newsItem.title}</h1>
        
        <div className="news-meta">
          <span className="news-source">
            Source: {newsItem.source.name}
          </span>
          <span className={getBiasClass(newsItem.source.bias)}>
            {getBiasLabel(newsItem.source.bias)}
          </span>
          <span className="news-date">
            {new Date(newsItem.publishedAt).toLocaleString()}
          </span>
          <span className="news-category">
            {newsItem.category}
          </span>
        </div>
        
        <p className="news-description">{newsItem.description}</p>
        
        <div className="news-keywords">
          <h3>Keywords:</h3>
          <div className="keyword-list">
            {newsItem.keywords.map((keyword, index) => (
              <span key={index} className="keyword">{keyword}</span>
            ))}
          </div>
        </div>
        
        <a 
          href={newsItem.url} 
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
