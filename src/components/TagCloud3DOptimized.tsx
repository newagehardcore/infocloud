import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NewsCategory, TagCloudWord } from '../types';
import { Word } from './Word';
import { throttle, detectDeviceCapabilities, getAdaptiveRenderingSettings, PerformanceMonitor } from '../utils/performance';
import './TagCloud3D.css';
import * as THREE from 'three';

// Animated spheres component that uses useFrame
const AnimatedSpheres: React.FC<{
  spheres: {
    words: TagCloudWord[];
    positions: [number, number, number][];
  }[];
  onWordClick: (word: TagCloudWord) => void;
  selectedWord: string | null;
  newWords: Set<string>;
  getFontSize: (value: number) => number;
  getBiasColor: (bias: string) => string;
  renderSettings: any;
}> = ({ spheres, onWordClick, selectedWord, newWords, getFontSize, getBiasColor, renderSettings }) => {
  const sphereRefs = useRef<(THREE.Group | null)[]>([]);
  const NUM_SPHERES = spheres.length;

  // Animate sphere movements
  useFrame((state) => {
    sphereRefs.current.forEach((sphere, index) => {
      if (sphere) {
        // Create unique circular motion for each sphere
        const time = state.clock.getElapsedTime();
        const radius = 2;
        const speed = 0.2;
        const phaseOffset = (2 * Math.PI * index) / NUM_SPHERES;
        
        sphere.position.x = Math.sin(time * speed + phaseOffset) * radius;
        sphere.position.y = Math.cos(time * speed * 0.5 + phaseOffset) * radius * 0.5;
        sphere.position.z = Math.cos(time * speed + phaseOffset) * radius;
      }
    });
  });

  return (
    <>
      {spheres.map((sphere, sphereIndex) => (
        <group 
          key={sphereIndex}
          ref={el => sphereRefs.current[sphereIndex] = el}
        >
          {sphere.words.map((word, i) => (
            <Word
              key={word.text}
              word={word}
              position={sphere.positions[i]}
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
      ))}
    </>
  );
};

// Main tag cloud component with performance optimizations
const TagCloud3D: React.FC<{
  words: TagCloudWord[];
  onWordClick: (word: TagCloudWord) => void;
  selectedWord: string | null;
  newWords: Set<string>;
}> = ({ words, onWordClick, selectedWord, newWords }) => {
  // Commented out unused variables to fix linter warnings
  // const [deviceCapabilities, setDeviceCapabilities] = useState(detectDeviceCapabilities());
  const [renderSettings, setRenderSettings] = useState(getAdaptiveRenderingSettings());
  // const [fps, setFps] = useState<number>(60);
  const NUM_SPHERES = 3;
  
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
  
  // Calculate font size based on word frequency with more dramatic variation
  const getFontSize = useCallback((value: number): number => {
    const minSize = 0.2; // Smaller minimum
    const maxSize = 2.0; // Larger maximum
    const maxValue = Math.max(...words.map(w => w.value), 1);
    return minSize + ((value / maxValue) * (maxSize - minSize));
  }, [words]);
  
  // Generate positions for words in a sphere-like shape
  const generatePositions = useCallback((count: number, sphereIndex: number): [number, number, number][] => {
    const positions: [number, number, number][] = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle
    const sphereRadius = 5;
    // const sphereOffset = sphereIndex * sphereRadius * 2.5; // Space spheres apart
    
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = phi * i;
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      // Position relative to sphere center
      positions.push([
        x * sphereRadius + (sphereIndex - 1) * sphereRadius * 2.5,
        y * sphereRadius,
        z * sphereRadius
      ]);
    }
    
    return positions;
  }, []);
  
  // Initialize performance monitor
  useEffect(() => {
    const monitor = new PerformanceMonitor((currentFps) => {
      // setFps(currentFps);
      // Using the FPS data for potential future optimizations but not currently using the state
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
      // setDeviceCapabilities(detectDeviceCapabilities());
      setRenderSettings(getAdaptiveRenderingSettings());
    }, 500);
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Distribute words among spheres
  const wordsPerSphere = Math.ceil(words.length / NUM_SPHERES);
  const spheres = Array.from({ length: NUM_SPHERES }, (_, sphereIndex) => {
    const startIdx = sphereIndex * wordsPerSphere;
    const sphereWords = words.slice(startIdx, startIdx + wordsPerSphere);
    return {
      words: sphereWords,
      positions: generatePositions(sphereWords.length, sphereIndex)
    };
  });
  
  return (
    <Canvas 
      camera={{ position: [0, 0, 20], fov: 75 }}
      dpr={renderSettings.pixelRatio}
      performance={{ min: 0.5 }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      <AnimatedSpheres
        spheres={spheres}
        onWordClick={onWordClick}
        selectedWord={selectedWord}
        newWords={newWords}
        getFontSize={getFontSize}
        getBiasColor={getBiasColor}
        renderSettings={renderSettings}
      />
      
      <OrbitControls 
        enableZoom={true}
        enablePan={false}
        autoRotate={renderSettings.enableAutoRotate}
        autoRotateSpeed={0.5}
        minDistance={10}
        maxDistance={40}
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
