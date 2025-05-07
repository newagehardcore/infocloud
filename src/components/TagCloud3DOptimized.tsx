import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { NewsCategory, TagCloudWord, PoliticalBias } from '../types';
import { throttle, getAdaptiveRenderingSettings, PerformanceMonitor } from '../utils/performance';
import './TagCloud3D.css';
import StarfieldTags from './StarfieldTags';

// Define min/max size constants
const MIN_FONT_SIZE = 0.5; // Adjusted slightly larger minimum
const MAX_FONT_SIZE = 4.5;
const RANK_SCALE_POWER = 55.0; // Power for rank-based scaling (higher = smaller words shrink faster)

// Main tag cloud component with performance optimizations
const TagCloud3D: React.FC<{
  words: TagCloudWord[];
  onWordClick: (word: TagCloudWord, position: { top: number; left: number }) => void;
  selectedWord: string | null;
  newWords: Set<string>;
}> = ({ words, onWordClick, selectedWord, newWords }) => {
  const [renderSettings, setRenderSettings] = useState(getAdaptiveRenderingSettings());
  const [positions, setPositions] = useState<[number, number, number][]>([]);
  const [fontSizes, setFontSizes] = useState<Map<string, number>>(new Map()); // State for calculated font sizes
  
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
  
  // Calculate all font sizes based on rank when words change
  useEffect(() => {
    if (words.length === 0) {
      setFontSizes(new Map());
      return;
    }

    // Sort words by frequency (value) descending
    const sortedWords = [...words].sort((a, b) => b.value - a.value);
    const newFontSizes = new Map<string, number>();
    const count = sortedWords.length;

    sortedWords.forEach((word, rank) => {
      // Normalize rank (0 = highest frequency, 1 = lowest frequency)
      // Handle edge case of a single word (rank 0 / (1-1 || 1) -> 0)
      const normalizedRank = count > 1 ? rank / (count - 1) : 0;

      // Apply inverse power scaling to the normalized rank
      // (1 - normalizedRank) maps lowest freq (rank 1) to 0, highest freq (rank 0) to 1
      const scaledRankFactor = Math.pow(1 - normalizedRank, RANK_SCALE_POWER);

      // Calculate final size
      const fontSize = MIN_FONT_SIZE + scaledRankFactor * (MAX_FONT_SIZE - MIN_FONT_SIZE);
      newFontSizes.set(word.text, fontSize);
    });

    setFontSizes(newFontSizes);

  }, [words]); // Recalculate only when words array changes
  
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
    
    // Find max frequency for normalization (still needed for positioning)
    const maxValue = Math.max(...words.map(w => w.value), 1); // Keep local max for positioning logic
    
    // Create a map of canonical forms to their positions
    const canonicalPositions = new Map<string, [number, number, number]>();
    
    return words.map(word => {
      // If this word has variants or is a variant, use the canonical form for position base
      const isVariant = word.variants && word.variants.size > 0;
      const seed = hashStringToSeed(word.text);
      
      // Normalize word frequency to 0-1 range (FOR POSITIONING ONLY)
      const frequencyFactor = word.value / maxValue;
      // Invert and dampen the frequency factor (high frequency = closer to center)
      const distanceFactor = Math.pow(1 - frequencyFactor, 0.5); // Keep positioning logic based on relative frequency
      
      // If this is a canonical form with variants, store its position
      if (isVariant) {
        if (!canonicalPositions.has(word.text)) {
          // Calculate base position for the canonical form
          const baseRadius = (((seed % 9973) / 9973) * 0.8 + 0.2) * // Random base 0.2-1.0
                          CLOUD_SIZE * 
                          (0.2 + distanceFactor * 0.8); // Scale by frequency // Uses updated distanceFactor
          
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
                        (0.2 + distanceFactor * 0.8); // Scale by frequency // Uses updated distanceFactor
        
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
    // We still need positions generated per word set
    if (words.length > 0) {
        setPositions(generateDeterministicPositions(words));
    } else {
        setPositions([]);
    }
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
      console.log(`TagCloud3D received ${words.length} words. Sample biases (first word):`, 
        words[0]?.biases); // Log the biases array of the first word
      // Example of how to count occurrences of each bias across all words:
      const biasCounts = words.reduce((acc, word) => {
        if (word.biases) {
          word.biases.forEach(b => {
            acc[b] = (acc[b] || 0) + 1;
          });
        }
        return acc;
      }, {} as Record<PoliticalBias, number>);
      console.log('Bias distribution:', biasCounts);
    }
  }, [words]);
  
  return (
    <Canvas 
      style={{ width: '100%', height: '100%', background: 'transparent' }}
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
        fontSizes={fontSizes}
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

// Container component that might handle loading or context
const TagCloud3DContainer: React.FC<{
  category: NewsCategory | 'all'; // Allow 'all' for category prop
  words?: TagCloudWord[];
  onWordSelect?: (word: TagCloudWord, position: { top: number; left: number }) => void;
  selectedWord?: string | null;
}> = ({ 
  category, 
  words = [],
  onWordSelect,
  selectedWord = null
}) => {
  // TODO: Handle the 'all' category case if needed for specific logic here
  // For now, we just accept the type. It might be used for fetching or passed down.
  
  // Use a state for newWords set to track animations
  const [newWords, setNewWords] = useState<Set<string>>(new Set());
  const prevWordsRef = useRef<TagCloudWord[]>([]);

  // Detect new words when the words prop changes
  useEffect(() => {
    const currentWordTexts = new Set(words.map(w => w.text));
    const prevWordTexts = new Set(prevWordsRef.current.map(w => w.text));
    const newlyAdded = new Set<string>();

    currentWordTexts.forEach(text => {
      if (!prevWordTexts.has(text)) {
        newlyAdded.add(text);
      }
    });

    setNewWords(newlyAdded);
    prevWordsRef.current = words; // Update previous words for next comparison
    
    // Optional: Clear the 'new' status after animation duration (e.g., 1 second)
    // const timer = setTimeout(() => setNewWords(new Set()), 1000);
    // return () => clearTimeout(timer);

  }, [words]);
  
  // Handle word click event
  const handleWordClick = (word: TagCloudWord, position: { top: number; left: number }) => {
    if (onWordSelect) {
      onWordSelect(word, position);
    }
  };
  
  // Render the actual TagCloud3D component, passing down props
  return (
    <TagCloud3D 
      words={words} 
      onWordClick={handleWordClick} 
      selectedWord={selectedWord}
      newWords={newWords} // Pass the set of new words
    />
  );
};

export default TagCloud3DContainer;
