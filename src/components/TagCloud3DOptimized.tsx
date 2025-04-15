import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NewsCategory, TagCloudWord } from '../types';
import { Word } from './Word';
import { throttle, detectDeviceCapabilities, getAdaptiveRenderingSettings, PerformanceMonitor } from '../utils/performance';
import './TagCloud3D.css';
import * as THREE from 'three';

// Random starfield component that displays words randomly distributed
const StarfieldTags: React.FC<{
  words: TagCloudWord[];
  positions: [number, number, number][];
  onWordClick: (word: TagCloudWord) => void;
  selectedWord: string | null;
  newWords: Set<string>;
  getFontSize: (value: number) => number;
  getBiasColor: (bias: string) => string;
  renderSettings: any;
}> = ({ words, positions, onWordClick, selectedWord, newWords, getFontSize, getBiasColor, renderSettings }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Ensure we have valid positions for all words
  const validPositions = positions.length >= words.length ? 
    positions : 
    Array(words.length).fill([0, 0, 0]);

  // A consistent fontSize function
  const getConsistentFontSize = (value: number): number => {
    // Fixed size for all words to ensure complete consistency
    return 0.4;
  };

  // Add gentle continuous movement
  useFrame((state) => {
    if (!groupRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Individual word movement
    words.forEach((_, index) => {
      const child = groupRef.current?.children[index];
      if (!child) return;

      // Create unique but stable movement for each word
      const uniqueOffset = Math.sin(index * 0.1) * 10;
      const xFreq = 0.2 + Math.sin(index * 0.05) * 0.1;
      const yFreq = 0.25 + Math.cos(index * 0.05) * 0.1;
      const zFreq = 0.3 + Math.sin(index * 0.05) * 0.1;
      
      // Apply more noticeable floating movement relative to original position
      const originalPosition = validPositions[index];
      child.position.set(
        originalPosition[0] + Math.sin(time * xFreq + uniqueOffset) * 0.5,
        originalPosition[1] + Math.cos(time * yFreq + uniqueOffset) * 0.5,
        originalPosition[2] + Math.sin(time * zFreq + uniqueOffset) * 0.5
      );
    });
  });

  return (
    <group ref={groupRef}>
      {words.map((word, i) => (
        <Word
          key={word.text}
          word={word}
          position={validPositions[i]}
          fontSize={getFontSize(word.value)}
          color={getBiasColor(word.bias)}
          onClick={() => onWordClick(word)}
          isSelected={selectedWord === word.text}
          isNew={newWords.has(word.text)}
          animationSpeed={renderSettings.animationSpeed}
          useSimpleRendering={renderSettings.useSimpleRendering}
        />
      ))}
    </group>
  );
};

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
  const getBiasColor = useCallback((bias: string): string => {
    switch (bias) {
      case 'mainstream-left': return '#6495ED'; // Light blue
      case 'alternative-left': return '#00008B'; // Dark blue
      case 'centrist': return '#800080'; // Purple
      case 'mainstream-right': return '#FFB6C1'; // Light red
      case 'alternative-right': return '#FF0000'; // Bright red
      default: return '#808080'; // Gray for unclear
    }
  }, []);
  
  // Calculate font size based on word frequency with more dramatic variation
  const getFontSize = useCallback((value: number): number => {
    // Fixed size for all words to ensure complete consistency
    return 0.4;
  }, []);
  
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
