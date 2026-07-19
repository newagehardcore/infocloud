import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
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

// Watchdog inside the Canvas: r3f's "always" frameloop can die on initial
// mount (rAF chain breaks); invalidate() restarts it if no frame has run recently.
const FrameloopWatchdog: React.FC = () => {
  const invalidate = useThree(state => state.invalidate);
  const clock = useThree(state => state.clock);
  useEffect(() => {
    // r3f's render loop stops when no root needs frames, and the mount-time
    // invalidate can fire before the root is activated (returning early) —
    // leaving frameloop="always" permanently stalled until some interaction
    // invalidates again. Nudge it whenever the clock stops advancing.
    let lastElapsed = -1;
    const id = setInterval(() => {
      if (clock.elapsedTime === lastElapsed) {
        invalidate();
      }
      lastElapsed = clock.elapsedTime;
    }, 500);
    return () => clearInterval(id);
  }, [invalidate, clock]);
  return null;
};

// Main tag cloud component with performance optimizations
const TagCloud3D: React.FC<{
  words: TagCloudWord[];
  onWordClick: (word: TagCloudWord, position: { top: number; left: number }) => void;
  selectedWord: string | null;
  newWords: Set<string>;
}> = ({ words, onWordClick, selectedWord, newWords }) => {
  const [renderSettings, setRenderSettings] = useState(getAdaptiveRenderingSettings());
  
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
  
  // Calculate all font sizes based on rank, synchronously with the words.
  // (useMemo, not effect state: positions/sizes must never lag one render
  // behind `words`, or a large word briefly renders at another word's
  // near-camera slot — the "white flash" on category switch.)
  const fontSizes = React.useMemo(() => {
    const newFontSizes = new Map<string, number>();
    if (words.length === 0) return newFontSizes;

    const sortedWords = [...words].sort((a, b) => b.value - a.value);
    const count = sortedWords.length;

    sortedWords.forEach((word, rank) => {
      const normalizedRank = count > 1 ? rank / (count - 1) : 0;
      const scaledRankFactor = Math.pow(1 - normalizedRank, RANK_SCALE_POWER);
      const fontSize = MIN_FONT_SIZE + scaledRankFactor * (MAX_FONT_SIZE - MIN_FONT_SIZE);
      newFontSizes.set(word.text, fontSize);
    });
    return newFontSizes;
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
    
    // Find max frequency for normalization (still needed for positioning)
    const maxValue = Math.max(...words.map(w => w.value), 1); // Keep local max for positioning logic
    
    // Create a map of canonical forms to their positions
    const canonicalPositions = new Map<string, [number, number, number]>();

    // Sort words by size to process largest words first
    const sortedWords = [...words].sort((a, b) => b.value - a.value);
    
    // Create a map to keep track of word text to index in the original array
    const wordToIndexMap = new Map<string, number>();
    words.forEach((word, index) => {
      wordToIndexMap.set(word.text, index);
    });
    
    // Keep track of largest words' positions to enforce minimum distance
    const largeWordPositions: { position: [number, number, number]; size: number; text: string }[] = [];
    
    // Calculate desired positions for all words
    const positions: ([number, number, number] | null)[] = new Array(words.length).fill(null);
    
    // Process words in order of size (largest first)
    for (const word of sortedWords) {
      const index = wordToIndexMap.get(word.text)!;
      const normalizedValue = word.value / maxValue;
      const isLargeWord = normalizedValue > 0.5; // Consider words with >50% of max value as "large"
      
      // Generate the initial position
      let position = generatePositionForWord(word);
      
      // For large words, ensure minimum distance from other large words
      if (isLargeWord && largeWordPositions.length > 0) {
        // Calculate font size for this word
        const fontSize = fontSizes.get(word.text) || MIN_FONT_SIZE;
        
        // Try repositioning up to 5 times to avoid overlaps
        for (let attempts = 0; attempts < 5; attempts++) {
          let tooClose = false;
          
          // Check distance to other large words
          for (const existingWord of largeWordPositions) {
            const combinedSize = fontSize + existingWord.size;
            const minDistance = combinedSize * 0.8; // Minimum distance as a factor of combined size
            
            const distance = Math.sqrt(
              Math.pow(position[0] - existingWord.position[0], 2) +
              Math.pow(position[1] - existingWord.position[1], 2) +
              Math.pow(position[2] - existingWord.position[2], 2)
            );
            
            if (distance < minDistance) {
              tooClose = true;
              break;
            }
          }
          
          if (!tooClose) break; // Position is good
          
          // If too close, adjust the position by pushing further out
          // Get a new position with slightly larger radius
          position = generatePositionForWord(word, 1.2 + attempts * 0.3);
        }
        
        // Add this word to the large word list
        largeWordPositions.push({
          position,
          size: fontSize,
          text: word.text
        });
      }
      
      // Store the final position
      positions[index] = position;
    }
    
    // Helper function to generate position for a single word
    function generatePositionForWord(word: TagCloudWord, radiusMultiplier: number = 1): [number, number, number] {
      const isVariant = word.variants && word.variants.size > 0;
      const seed = hashStringToSeed(word.text);
      
      // Normalize word frequency to 0-1 range (FOR POSITIONING ONLY)
      const frequencyFactor = word.value / maxValue;
      // Invert and dampen the frequency factor (high frequency = further from center for large words)
      const distanceFactor = Math.pow(1 - frequencyFactor, 0.5); 
      
      // For higher frequency words (larger ones), push them slightly further out
      const highFrequencyFactor = frequencyFactor > 0.5 ? 0.3 + frequencyFactor * 0.4 : 0;
      
      if (isVariant) {
        if (!canonicalPositions.has(word.text)) {
          // Calculate base position for the canonical form
          const baseRadius = (((seed % 9973) / 9973) * 0.8 + 0.2) * // Random base 0.2-1.0
                          CLOUD_SIZE * 
                          (0.2 + distanceFactor * 0.8 + highFrequencyFactor) * // Scale by frequency with extra factor for large words
                          radiusMultiplier; // Apply any radius multiplier
          
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
                        (0.2 + distanceFactor * 0.8 + highFrequencyFactor) * // Scale by frequency with extra factor for large words
                        radiusMultiplier; // Apply any radius multiplier
        
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
    }
    
    // Clamp positions into a bounded shell so no word can sit near the camera
    // (camera is at z=60; an unclamped word at z~45 fills the whole viewport)
    const MAX_RADIUS = 28;
    const MAX_DEPTH = 20;
    const clampPosition = (pos: [number, number, number]): [number, number, number] => {
      let [x, y, z] = pos;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return [0, 0, 0];
      }
      const r = Math.sqrt(x * x + y * y + z * z);
      if (r > MAX_RADIUS) {
        const s = MAX_RADIUS / r;
        x *= s; y *= s; z *= s;
      }
      z = Math.max(-MAX_DEPTH, Math.min(MAX_DEPTH, z));
      return [x, y, z];
    };

    // Return positions array, converting any null values to default position
    return positions.map(pos => clampPosition(pos || [0, 0, 0]));
  }, [hashStringToSeed, fontSizes]);

  // Positions computed synchronously with words + fontSizes (see note above)
  const positions = React.useMemo(
    () => (words.length > 0 ? generateDeterministicPositions(words) : []),
    [words, generateDeterministicPositions]
  );
  
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
      <FrameloopWatchdog />
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

  // Defer mounting the Canvas until the first words arrive. Mounting it while
  // the app is mid-load (loading-bar interval re-rendering the tree every
  // 30ms) can permanently break r3f's initialization — the scene never
  // commits and the cloud stays blank until a resize/click.
  const [canvasReady, setCanvasReady] = useState(false);
  useEffect(() => {
    if (!canvasReady && words.length > 0) {
      const t = setTimeout(() => setCanvasReady(true), 150);
      return () => clearTimeout(t);
    }
  }, [canvasReady, words]);

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
  if (!canvasReady) return null;
  return (
    <TagCloud3D
      words={words}
      onWordClick={handleWordClick}
      selectedWord={selectedWord}
      newWords={newWords} // Pass the set of new words
    />
  );
};

// Memoized: parent (App) re-renders at high frequency during the loading
// animation, and re-rendering the Canvas while r3f is initializing prevents
// its content from ever mounting (blank cloud until a resize/click).
export default React.memo(TagCloud3DContainer);
