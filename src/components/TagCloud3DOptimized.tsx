import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { NewsCategory, TagCloudWord, PoliticalBias } from '../types';
import { throttle, getAdaptiveRenderingSettings, PerformanceMonitor } from '../utils/performance';
import './TagCloud3D.css';
import StarfieldTags from './StarfieldTags';

// Main tag cloud component with performance optimizations
const TagCloud3D: React.FC<{
  words: TagCloudWord[];
  onWordClick: (word: TagCloudWord, position: { top: number; left: number }) => void;
  selectedWord: string | null;
  newWords: Set<string>;
}> = ({ words, onWordClick, selectedWord, newWords }) => {
  const [renderSettings, setRenderSettings] = useState(getAdaptiveRenderingSettings());
  const [positions, setPositions] = useState<[number, number, number][]>([]);
  
  // Get color based on political bias
  const getBiasColor = useCallback((bias: PoliticalBias): string => {
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
  
  // Deterministic position generator based on word text
  const hashStringToSeed = useCallback((str: string): number => {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    }
    return Math.abs(hash);
  }, []);

  // Generate positions with frequency-based clustering
  const generateDeterministicPositions = useCallback((words: TagCloudWord[]): [number, number, number][] => {
    const CLOUD_SIZE = 30; // Smaller base size for tighter clustering
    const DEPTH_FACTOR = 1.5; // Reduced depth range
    
    // Find max frequency for normalization
    const maxValue = Math.max(...words.map(w => w.value));
    
    // Create a map of canonical forms to their positions
    const canonicalPositions = new Map<string, [number, number, number]>();
    
    return words.map(word => {
      // If this word has variants or is a variant, use the canonical form for position base
      const isVariant = word.variants && word.variants.size > 0;
      const seed = hashStringToSeed(word.text);
      
      // Normalize word frequency to 0-1 range
      const frequencyFactor = word.value / maxValue;
      // Invert and dampen the frequency factor (high frequency = closer to center)
      const distanceFactor = Math.pow(1 - frequencyFactor, 0.7);
      
      // If this is a canonical form with variants, store its position
      if (isVariant) {
        if (!canonicalPositions.has(word.text)) {
          // Calculate base position for the canonical form
          const baseRadius = (((seed % 9973) / 9973) * 0.8 + 0.2) * // Random base 0.2-1.0
                          CLOUD_SIZE * 
                          (0.2 + distanceFactor * 0.8); // Scale by frequency
          
          const goldenRatio = 1.618033988749895;
          const i = seed % 500;
          
          const theta = i * goldenRatio * Math.PI * 2;
          const phi = Math.acos(1 - 2 * ((seed % 997) / 997));
          
          const zNoise = ((seed >> 5) % 997) / 997 - 0.5;
          
          const x = baseRadius * Math.sin(phi) * Math.cos(theta);
          const y = baseRadius * Math.cos(phi);
          const z = (baseRadius * Math.sin(phi) * Math.sin(theta) + zNoise * 5) * DEPTH_FACTOR;
          
          canonicalPositions.set(word.text, [x, y, z]);
        }
        
        // Get the canonical position and add a small offset
        const [baseX, baseY, baseZ] = canonicalPositions.get(word.text)!;
        const variantOffset = 2; // Small offset for variants
        const variantAngle = (seed % 360) * Math.PI / 180;
        
        return [
          baseX + Math.cos(variantAngle) * variantOffset,
          baseY + Math.sin(variantAngle) * variantOffset,
          baseZ + (seed % 3 - 1) * variantOffset
        ] as [number, number, number];
      } else {
        // For non-variant words, use the original positioning logic
        const baseRadius = (((seed % 9973) / 9973) * 0.8 + 0.2) * // Random base 0.2-1.0
                        CLOUD_SIZE * 
                        (0.2 + distanceFactor * 0.8); // Scale by frequency
        
        const goldenRatio = 1.618033988749895;
        const i = seed % 500;
        
        const theta = i * goldenRatio * Math.PI * 2;
        const phi = Math.acos(1 - 2 * ((seed % 997) / 997));
        
        const zNoise = ((seed >> 5) % 997) / 997 - 0.5;
        
        const x = baseRadius * Math.sin(phi) * Math.cos(theta);
        const y = baseRadius * Math.cos(phi);
        const z = (baseRadius * Math.sin(phi) * Math.sin(theta) + zNoise * 5) * DEPTH_FACTOR;
        
        return [x, y, z] as [number, number, number];
      }
    });
  }, [hashStringToSeed]);

  // Update positions when words change, using deterministic positioning
  useEffect(() => {
    setPositions(generateDeterministicPositions(words));
  }, [words, generateDeterministicPositions]);
  
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
    }
  }, [words]);
  
  return (
    <Canvas 
      camera={{ 
        position: [0, 0, 60],
        fov: 45,
        near: 0.1,
        far: 1000
      }}
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
        autoRotate={true}
        autoRotateSpeed={0.05}
        minDistance={0.1}
        maxDistance={200}
        enableDamping={true}
        dampingFactor={0.005}
        rotateSpeed={5.05}
        zoomSpeed={1.2}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />
    </Canvas>
  );
};

// Container component that manages data and state
const TagCloud3DContainer: React.FC<{
  category: NewsCategory;
  words?: TagCloudWord[];
  onWordSelect?: (word: TagCloudWord, position: { top: number; left: number }) => void;
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
  
  const handleWordClick = useCallback((word: TagCloudWord, position: { top: number; left: number }) => {
    if (onWordSelect) {
      onWordSelect(word, position);
    }
  }, [onWordSelect]);
  
  return (
    <div className="tag-cloud-3d" style={{ background: '#111', minHeight: 400, width: '100%' }}>
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
