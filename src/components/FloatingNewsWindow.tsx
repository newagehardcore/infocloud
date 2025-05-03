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
  clickedWordBias: PoliticalBias | null;
  onClose: () => void;
  onMove?: (pos: { top: number; left: number }) => void;
}

const FloatingNewsWindow: React.FC<FloatingNewsWindowProps> = ({ data, position, clickedWordBias, onClose, onMove }) => {
  const { wordData, newsItems } = data;
  const [isVisible, setIsVisible] = useState(false);
  const [expandedBiases, setExpandedBiases] = useState<{ [key: string]: boolean }>({});
  const windowRef = useRef<HTMLDivElement>(null);

  // --- Drag state ---
  const [dragPos, setDragPos] = useState<{ top: number; left: number } | null>(null);
  const dragStartPos = useRef<{ mouseX: number; mouseY: number; offsetX: number; offsetY: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestDrag = useRef<{ top: number; left: number } | null>(null);

  // --- Drag handlers ---
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (!windowRef.current) return;
    e.preventDefault();
    const rect = windowRef.current.getBoundingClientRect();
    dragStartPos.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    document.addEventListener('mousemove', handleMouseMoveDom);
    document.addEventListener('mouseup', handleMouseUpDom);
  };

  const handleMouseMoveDom = (e: MouseEvent) => {
    if (!dragStartPos.current || !windowRef.current) return;
    const newLeft = e.clientX - dragStartPos.current.offsetX;
    const newTop = e.clientY - dragStartPos.current.offsetY;
    windowRef.current.style.left = `${newLeft}px`;
    windowRef.current.style.top = `${newTop}px`;
    windowRef.current.style.right = 'auto';
    windowRef.current.style.bottom = 'auto';
  };

  const handleMouseUpDom = (e: MouseEvent) => {
    if (!dragStartPos.current || !windowRef.current) return;
    // Persist the final position in React state and notify parent
    const newLeft = e.clientX - dragStartPos.current.offsetX;
    const newTop = e.clientY - dragStartPos.current.offsetY;
    setDragPos({ top: newTop, left: newLeft });
    if (onMove) {
      onMove({ top: newTop, left: newLeft });
    }
    dragStartPos.current = null;
    document.removeEventListener('mousemove', handleMouseMoveDom);
    document.removeEventListener('mouseup', handleMouseUpDom);
  };

  // Initialize expanded state for accordions based on clicked word's bias
  useEffect(() => {
    const initialExpandedState: { [key: string]: boolean } = {};
    biasOrder.forEach(bias => {
       // Only expand if this bias matches the clicked word's bias
       initialExpandedState[bias] = bias === clickedWordBias;
    });
    setExpandedBiases(initialExpandedState);
  }, [newsItems, clickedWordBias]); // Add clickedWordBias dependency

  useEffect(() => {
    setIsVisible(!!position);
  }, [position]);

  // Group news items by source bias
  const biasGroups = useMemo(() => {
    const groups: { [key: string]: NewsItem[] } = {};
    // Filter items first to ensure they contain the word/phrase (case-insensitive)
    const filteredItems = newsItems.filter(item =>
      item.title.toLowerCase().includes(wordData.text.toLowerCase())
    );

    filteredItems.forEach(item => {
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
  }, [newsItems, wordData.text]); // Add wordData.text as dependency

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

  // Use drag position if dragging, else use initial position
  const windowStyle = dragPos
    ? { top: dragPos.top, left: dragPos.left, position: 'fixed' as const }
    : {
        top: `calc(${position.top}px + ${offsetY}px)`,
        left: `calc(${position.left}px + ${offsetX}px)`
      };

  return (
    <AnimatePresence>
      {isVisible && (
          // Removed backdrop motion.div wrapper
          <motion.div
            ref={windowRef}
            className="floating-news-window"
            style={windowStyle}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={windowVariants}
            layout // Keep layout animation for smoother resizing
          >
            <div className="floating-news-header" onMouseDown={handleHeaderMouseDown} style={{ cursor: 'move', userSelect: 'none' }}>
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
                        style={{ color: getBiasColor(bias), WebkitTextFillColor: getBiasColor(bias) }}
                        onClick={() => toggleBiasExpand(bias)}
                        role="button"
                        tabIndex={0}
                        onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && toggleBiasExpand(bias)}
                      >
                        <span className={`accordion-icon${expandedBiases[bias] ? ' expanded' : ''}`}
                          >
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
                                  <span className="news-title">
                                    <span>{item.title}</span>
                                  </span>
                                  <div className="news-meta">
                                    <span className="source-name" style={{ color: getBiasColor(item.source.bias) }}>{item.source.name}</span>
                                    <span className="publish-date" style={{ color: getBiasColor(item.source.bias) }}>{new Date(item.publishedAt).toLocaleDateString()}</span>
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