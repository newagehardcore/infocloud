import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NewsCategory, TagCloudWord, PoliticalBias } from '../types';
import { Word } from './Word';
import { throttle, getAdaptiveRenderingSettings, PerformanceMonitor } from '../utils/performance';
import './TagCloud3D.css';
import * as THREE from 'three';
import StarfieldTags from './StarfieldTags';

// Main tag cloud component with performance optimizations
const TagCloud3D: React.FC<{
  words: TagCloudWord[];
  onWordClick: (word: TagCloudWord) => void;
  selectedWord: string | null;
  newWords: Set<string>;
}> = ({ words, onWordClick, selectedWord, newWords }) => {
  const [renderSettings, setRenderSettings] = useState(getAdaptiveRenderingSettings());
  const [positions, setPositions] = useState<[number, number, number][]>([]);
  
  // Get color based on political bias
  const getBiasColor = useCallback((bias: PoliticalBias): string => {
    // Debug: Log the bias value to see what's actually being passed
    console.log('Bias value received:', bias, typeof bias);
    
    // Convert to string to ensure consistent comparison
    const biasString = String(bias);
    
    switch (biasString) {
      case 'mainstream-democrat': 
        return '#6495ED'; // Light blue
      case 'alternative-left': 
        return '#00008B'; // Dark blue
      case 'centrist': 
        return '#800080'; // Purple
      case 'mainstream-republican': 
        return '#FFB6C1'; // Light red
      case 'alternative-right': 
        return '#FF0000'; // Bright red
      default: 
        console.log(`Default case hit for bias: "${bias}" (type: ${typeof bias})`);
        return '#808080'; // Gray for unclear
    }
  }, []);
  
  // Calculate font size based on word frequency with more dramatic variation
  const getFontSize = useCallback((value: number): number => {
    const minSize = 0.1; // Smaller base size
    const maxSize = 4.5; // Restored larger maximum size
    const maxValue = Math.max(...words.map(w => w.value), 1); // Find max frequency
    
    // Use a power scale for non-linear sizing
    const scalePower = 0.8; // Kept high power to keep many words small
    const normalizedValue = value / maxValue;
    
    // Calculate size, ensuring it doesn't go below minSize
    return minSize + (Math.pow(normalizedValue, scalePower) * (maxSize - minSize));
  }, [words]);
  
  // Generate random positions in a starfield configuration
  const generateStarfieldPositions = useCallback((count: number): [number, number, number][] => {
    const positions: [number, number, number][] = [];
    const STARFIELD_SIZE = 40; // Size of the starfield cube
    
    for (let i = 0; i < count; i++) {
      // Generate random positions in a cube
      const x = (Math.random() - 0.5) * STARFIELD_SIZE;
      const y = (Math.random() - 0.5) * STARFIELD_SIZE;
      const z = (Math.random() - 0.5) * STARFIELD_SIZE;
      
      positions.push([x, y, z]);
    }
    
    return positions;
  }, []);

  // Update positions when words change
  useEffect(() => {
    setPositions(generateStarfieldPositions(words.length));
  }, [words, generateStarfieldPositions]);
  
  // Initialize performance monitor
  useEffect(() => {
    const monitor = new PerformanceMonitor((currentFps) => {
      if (currentFps < 30) {
        setRenderSettings(prev => ({
          ...prev,
          useSimpleRendering: true,
          pixelRatio: 1,
          enableAutoRotate: false
        }));
      }
    });
    
    monitor.start();
    
    return () => {
      monitor.stop();
    };
  }, []);
  
  // Update device capabilities on window resize
  useEffect(() => {
    const handleResize = throttle(() => {
      setRenderSettings(getAdaptiveRenderingSettings());
    }, 500);
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Debug log when words change
  useEffect(() => {
    if (words.length > 0) {
      console.log(`TagCloud3D received ${words.length} words with biases:`, 
        words.reduce((acc, word) => {
          acc[word.bias] = (acc[word.bias] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));
    } else {
      console.log('TagCloud3D received empty words array');
    }
  }, [words]);
  
  return (
    <Canvas 
      camera={{ position: [0, 0, 20], fov: 75 }}
      dpr={renderSettings.pixelRatio}
      performance={{ min: 0.5 }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      <StarfieldTags
        words={words}
        positions={positions}
        onWordClick={onWordClick}
        selectedWord={selectedWord}
        newWords={newWords}
        getFontSize={getFontSize}
        getBiasColor={getBiasColor}
        renderSettings={renderSettings}
      />
      
      <OrbitControls 
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        autoRotate={false}
        minDistance={1}
        maxDistance={100}
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
    <div className="tag-cloud-3d" style={{ background: '#111', minHeight: 400, width: '100%' }}>
      <div className="status-indicator">
        <span className="live-indicator">Live Updates</span>
      </div>
      
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
  );
};

export default TagCloud3DContainer;
