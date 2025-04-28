import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NewsItem, TagCloudWord, PoliticalBias } from '../types'; // Assuming types are correctly imported
import './FloatingNewsWindow.css';

// --- Logic copied/adapted from RelatedNewsPanel ---
// (Will be inserted here later)
const biasOrder = [
  PoliticalBias.Left,
  PoliticalBias.Liberal,
  PoliticalBias.Centrist,
  PoliticalBias.Unknown, // Assuming Unknown is a valid enum member
  PoliticalBias.Conservative,
  PoliticalBias.Right
];

const getBiasLabel = (bias: PoliticalBias): string => {
  switch (bias) {
    case PoliticalBias.Left: return 'Left';
    case PoliticalBias.Liberal: return 'Liberal';
    case PoliticalBias.Centrist: return 'Centrist';
    case PoliticalBias.Conservative: return 'Conservative';
    case PoliticalBias.Right: return 'Right';
    case PoliticalBias.Unknown:
    default: return 'Unknown';
  }
};

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
// --- End of copied logic ---

interface FloatingNewsWindowProps {
  data: {
    wordData: TagCloudWord;
    newsItems: NewsItem[];
  };
  position: { top: number; left: number } | null;
  clickedWordBias: PoliticalBias | null; // Add bias of the clicked word
  onClose: () => void;
}

const FloatingNewsWindow: React.FC<FloatingNewsWindowProps> = ({ data, position, clickedWordBias, onClose }) => {
  const { wordData, newsItems } = data;
  const [isVisible, setIsVisible] = useState(false);
  const [expandedBiases, setExpandedBiases] = useState<{ [key: string]: boolean }>({});
  const windowRef = useRef<HTMLDivElement>(null);

  // Initialize expanded state for accordions based on clicked word's bias
  useEffect(() => {
    const initialExpandedState: { [key: string]: boolean } = {};
    biasOrder.forEach(bias => {
       // Only expand if this bias matches the clicked word's bias
       initialExpandedState[bias] = bias === clickedWordBias;
    });
    setExpandedBiases(initialExpandedState);
  }, [newsItems, clickedWordBias]); // Add clickedWordBias dependency

  // Handle clicks outside the window to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only close if the click is truly outside the window
      if (windowRef.current && !windowRef.current.contains(event.target as Node)) {
         // Check if the click target is part of the tag cloud or another interactive element
         // This logic might need refinement based on your specific DOM structure
         const targetElement = event.target as HTMLElement;
         // Example check: Prevent closing if clicking on an element *inside* the tag cloud container
         // You might need a more specific selector for your tag cloud implementation
         if (!targetElement.closest('.tag-cloud-container')) { // ADJUST SELECTOR AS NEEDED
            onClose();
         }
      }
    };

    // Add listener on mount if visible
    if (isVisible) {
      // Use setTimeout to ensure the listener isn't added until the initial click event bubble phase is over
      const timerId = setTimeout(() => {
         document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => {
         clearTimeout(timerId);
         document.removeEventListener('mousedown', handleClickOutside);
       };
    }
    // If you want the window to close when clicking *anything* outside, revert to simpler logic:
    // if (isVisible) {
    //   document.addEventListener('mousedown', handleClickOutside);
    // }
    // return () => {
    //   document.removeEventListener('mousedown', handleClickOutside);
    // };
  }, [isVisible, onClose]); // Dependencies remain the same

  useEffect(() => {
    setIsVisible(!!position);
  }, [position]);

  // Group news items by source bias
  const biasGroups = useMemo(() => {
    const groups: { [key: string]: NewsItem[] } = {};
    newsItems.forEach(item => {
      const bias = item.source.bias;
      if (!groups[bias]) {
        groups[bias] = [];
      }
      groups[bias].push(item);
    });
    // Sort items within each group by date (newest first)
    Object.values(groups).forEach(group => {
      group.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    });
    return groups;
  }, [newsItems]);

  const toggleBiasExpand = (bias: PoliticalBias) => {
    setExpandedBiases(prev => ({
      ...prev,
      [bias]: !prev[bias]
    }));
  };

  // Get bias groups in the desired order
  const orderedBiasGroups = useMemo(() => {
    return biasOrder
      .map(bias => [bias, biasGroups[bias]] as [PoliticalBias, NewsItem[]])
      .filter(([, items]) => items && items.length > 0);
  }, [biasGroups]);

  // Animation variants for Framer Motion
  const windowVariants = {
    hidden: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
  };

  if (!position) {
    return null;
  }

  // Adjust position slightly to center the window near the point
  const offsetX = -180; // Half of width (360px)
  const offsetY = 30;   // Offset below the click point

  return (
    <AnimatePresence>
      {isVisible && (
          // Removed backdrop motion.div wrapper
          <motion.div
            ref={windowRef}
            className="floating-news-window"
            style={{
              // Use CSS variables or direct calc() if needed for more dynamic positioning based on word
              top: `calc(${position.top}px + ${offsetY}px)`,
              left: `calc(${position.left}px + ${offsetX}px)`,
            }}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={windowVariants}
            layout // Keep layout animation for smoother resizing
          >
            <div className="floating-news-header">
              {/* Placeholder for word transition - replace h3 later */}
              <h3>News related to "{wordData.text}"</h3>
              <button onClick={onClose} className="floating-news-close-btn" aria-label="Close">
                &times;
              </button>
            </div>

            <div className="floating-news-content">
              {newsItems.length === 0 ? (
                <p className="no-news-message">No related news found.</p> // Added class for styling
              ) : (
                <div className="bias-groups">
                  {orderedBiasGroups.map(([bias, items]) => (
                    <div key={bias} className="bias-group">
                      <h4
                        className="bias-heading"
                        style={{ color: getBiasColor(bias) }}
                        onClick={() => toggleBiasExpand(bias)}
                        role="button"
                        tabIndex={0}
                        // Add explicit type for event object 'e'
                        onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && toggleBiasExpand(bias)}
                      >
                        <span className={`accordion-icon ${expandedBiases[bias] ? 'expanded' : ''}`}>
                          {/* Using simpler arrows for now */}
                          {expandedBiases[bias] ? '▼' : '▶'}
                        </span>
                        {getBiasLabel(bias)}
                        <span className="source-count">({items.length})</span>
                      </h4>
                      <AnimatePresence>
                        {expandedBiases[bias] && (
                          <motion.ul
                            className="news-list"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {items.map((item) => (
                              <li key={item.id} className="news-item">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="news-link">
                                  <span className="news-title">{item.title}</span>
                                  <div className="news-meta">
                                    <span className="source-name">{item.source.name}</span>
                                    <span className="publish-date">{new Date(item.publishedAt).toLocaleDateString()}</span>
                                  </div>
                                </a>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingNewsWindow; 