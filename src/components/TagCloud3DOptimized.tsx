import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NewsCategory, TagCloudWord } from '../types';
import { Word } from './Word';
import { throttle, detectDeviceCapabilities, getAdaptiveRenderingSettings, PerformanceMonitor } from '../utils/performance';
import './TagCloud3D.css';

// Main tag cloud component with performance optimizations
const TagCloud3D: React.FC<{
  words: TagCloudWord[];
  onWordClick: (word: TagCloudWord) => void;
  selectedWord: string | null;
  newWords: Set<string>;
}> = ({ words, onWordClick, selectedWord, newWords }) => {
  const [deviceCapabilities, setDeviceCapabilities] = useState(detectDeviceCapabilities());
  const [renderSettings, setRenderSettings] = useState(getAdaptiveRenderingSettings());
  const [fps, setFps] = useState<number>(60);
  
  // Get color based on political bias
  const getBiasColor = useCallback((bias: string): string => {
    switch (bias) {
      case 'mainstream-left': return '#6495ED'; // Pale blue
      case 'alternative-left': return '#0000FF'; // Bright blue
      case 'centrist': return '#800080'; // Purple
      case 'mainstream-right': return '#F08080'; // Pale red
      case 'alternative-right': return '#FF0000'; // Bright red
      default: return '#808080'; // Gray for unclear
    }
  }, []);
  
  // Calculate font size based on word frequency
  const getFontSize = useCallback((value: number): number => {
    const minSize = 0.3;
    const maxSize = 1.0;
    const maxValue = Math.max(...words.map(w => w.value), 1);
    return minSize + ((value / maxValue) * (maxSize - minSize));
  }, [words]);
  
  // Generate positions for words in a sphere-like shape
  const generatePositions = useCallback((count: number): [number, number, number][] => {
    const positions: [number, number, number][] = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle
    
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2; // y goes from 1 to -1
      const radius = Math.sqrt(1 - y * y); // radius at y
      
      const theta = phi * i; // Golden angle increment
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      // Scale to fit in a sphere with radius 5
      positions.push([x * 5, y * 5, z * 5]);
    }
    
    return positions;
  }, []);
  
  // Initialize performance monitor
  useEffect(() => {
    const monitor = new PerformanceMonitor((currentFps) => {
      setFps(currentFps);
    });
    
    monitor.start();
    
    return () => {
      monitor.stop();
    };
  }, []);
  
  // Update device capabilities on window resize
  useEffect(() => {
    const handleResize = throttle(() => {
      setDeviceCapabilities(detectDeviceCapabilities());
      setRenderSettings(getAdaptiveRenderingSettings());
    }, 500);
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Adjust word count based on device capabilities
  const optimizedWords = words.slice(0, renderSettings.maxWordCount);
  const positions = generatePositions(optimizedWords.length);
  
  return (
    <Canvas 
      camera={{ position: [0, 0, 10], fov: 75 }}
      dpr={renderSettings.pixelRatio}
      performance={{ min: 0.5 }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      {optimizedWords.map((word, i) => (
        <Word
          key={word.text}
          word={word}
          position={positions[i]}
          fontSize={getFontSize(word.value)}
          color={getBiasColor(word.bias)}
          onClick={() => onWordClick(word)}
          isSelected={selectedWord === word.text}
          isNew={newWords.has(word.text)}
          animationSpeed={renderSettings.animationSpeed}
          useSimpleRendering={renderSettings.useSimpleRendering}
        />
      ))}
      
      <OrbitControls 
        enableZoom={true}
        enablePan={false}
        autoRotate={renderSettings.enableAutoRotate}
        autoRotateSpeed={0.5}
        minDistance={6}
        maxDistance={20}
      />
    </Canvas>
  );
};

// Container component that manages data and state
const TagCloud3DContainer: React.FC<{
  category: NewsCategory;
  words?: TagCloudWord[];
  onWordSelect?: (word: TagCloudWord) => void;
  selectedWord?: string | null;
}> = ({ 
  category, 
  words = [],
  onWordSelect,
  selectedWord = null
}) => {
  const [newWords, setNewWords] = useState<Set<string>>(new Set());
  const prevWordsRef = useRef<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Track new words
  useEffect(() => {
    setIsLoading(true);
    
    const currentWordSet = new Set(words.map(w => w.text));
    const newWordsSet = new Set<string>();
    
    // Find words that weren't in the previous set
    currentWordSet.forEach(word => {
      if (!prevWordsRef.current.has(word)) {
        newWordsSet.add(word);
      }
    });
    
    if (newWordsSet.size > 0) {
      setNewWords(newWordsSet);
      
      // Clear new word status after 5 seconds
      setTimeout(() => {
        setNewWords(new Set());
      }, 5000);
    }
    
    // Update previous words for next comparison
    prevWordsRef.current = currentWordSet;
    setIsLoading(false);
  }, [words]); // Only depend on words changing
  
  const handleWordClick = useCallback((word: TagCloudWord) => {
    if (onWordSelect) {
      onWordSelect(word);
    }
  }, [onWordSelect]);
  
  return (
    <div className="tag-cloud-3d-container">
      <div className="status-indicator">
        <span className="live-indicator">Live Updates</span>
      </div>
      
      <div className="tag-cloud-3d">
        {isLoading ? (
          <div className="loading-indicator">Loading visualization...</div>
        ) : words.length === 0 ? (
          <div className="no-data-message">No data available for this category.</div>
        ) : (
          <TagCloud3D 
            words={words} 
            onWordClick={handleWordClick} 
            selectedWord={selectedWord}
            newWords={newWords}
          />
        )}
      </div>
    </div>
  );
};

export default TagCloud3DContainer;
