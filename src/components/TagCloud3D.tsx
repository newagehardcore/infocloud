import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { NewsCategory, TagCloudWord, NewsItem } from '../types';
import * as THREE from 'three';
import './TagCloud3D.css';
import HelveticaText from './HelveticaText';

// Word component for the 3D tag cloud
const Word = ({ 
  word, 
  position, 
  fontSize, 
  color, 
  onClick, 
  isSelected, 
  isNew 
}: { 
  word: TagCloudWord; 
  position: [number, number, number]; 
  fontSize: number; 
  color: string; 
  onClick: () => void; 
  isSelected: boolean;
  isNew: boolean;
}) => {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();
  
  // Validate position and ensure it's a proper tuple
  const safePosition: [number, number, number] = Array.isArray(position) && position.length === 3 
    ? [position[0], position[1], position[2]]
    : [0, 0, 0];
  
  // Animation for new words
  useEffect(() => {
    if (ref.current && isNew) {
      ref.current.scale.set(0, 0, 0);
    }
  }, [isNew]);
  
  // Frame animation
  useFrame((state, delta) => {
    if (!ref.current || !safePosition) return;
    
    // Always face the camera (billboarding)
    ref.current.quaternion.copy(camera.quaternion);
    
    // Grow animation for new words
    if (isNew && ref.current.scale.x < 1) {
      ref.current.scale.x += delta * 2;
      ref.current.scale.y += delta * 2;
      ref.current.scale.z += delta * 2;
    }
    
    // Hover and selection effects
    if (hovered || isSelected) {
      ref.current.scale.x = THREE.MathUtils.lerp(ref.current.scale.x, 1.2, delta * 5);
      ref.current.scale.y = THREE.MathUtils.lerp(ref.current.scale.y, 1.2, delta * 5);
      ref.current.scale.z = THREE.MathUtils.lerp(ref.current.scale.z, 1.2, delta * 5);
    } else {
      ref.current.scale.x = THREE.MathUtils.lerp(ref.current.scale.x, 1, delta * 5);
      ref.current.scale.y = THREE.MathUtils.lerp(ref.current.scale.y, 1, delta * 5);
      ref.current.scale.z = THREE.MathUtils.lerp(ref.current.scale.z, 1, delta * 5);
    }
    
    // Only apply floating animation if we have valid position data
    if (typeof safePosition[0] === 'number') {
      ref.current.position.y += Math.sin(state.clock.elapsedTime * 0.5 + safePosition[0] * 100) * 0.01;
    }
  });
  
  return (
    <mesh
      ref={ref}
      position={safePosition}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <HelveticaText
        fontSize={fontSize}
        color={color}
        isSelected={isSelected}
        onClick={onClick}
      >
        {word.text}
      </HelveticaText>
      {isNew && (
        <mesh>
          <sphereGeometry args={[fontSize * 0.6, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
      )}
    </mesh>
  );
};

// Main tag cloud component
const TagCloud3D: React.FC<{
  words: TagCloudWord[];
  onWordClick: (word: TagCloudWord) => void;
  selectedWord: string | null;
  newWords: Set<string>;
  isTimeMachineMode: boolean;
}> = ({ words, onWordClick, selectedWord, newWords, isTimeMachineMode }) => {
  // Get color based on political bias
  const getBiasColor = (bias: string): string => {
    switch (bias) {
      case 'mainstream-left': return '#6495ED'; // Light blue
      case 'alternative-left': return '#00008B'; // Dark blue
      case 'centrist': return '#800080'; // Purple
      case 'mainstream-right': return '#FFB6C1'; // Light red
      case 'alternative-right': return '#FF0000'; // Bright red
      default: return '#808080'; // Gray for unclear
    }
  };
  
  // Calculate font size based on word frequency
  const getFontSize = (value: number, wordsArray: TagCloudWord[]): number => {
    const minSize = 0.01; // Much smaller minimum size
    const maxSize = 0.25; // Smaller max size since we're scaling up dramatically in HelveticaText
    const maxValue = Math.max(...wordsArray.map(w => w.value), 1);
    
    // Use a non-linear scale with a higher power for extreme differentiation
    const normalizedValue = value / maxValue;
    
    // Get the rank of this word (1-based, where 1 is highest frequency)
    const rank = wordsArray.filter(w => w.value > value).length + 1;
    
    // For top 3 stories, use special scaling
    if (rank <= 3) {
      // Scale from 0.15 to 0.25 for top 3
      return 0.15 + ((3 - rank) * 0.05);
    }
    
    // For all other stories, use a very steep power curve
    // Power of 16 creates an extremely long tail of tiny words
    return minSize + (Math.pow(normalizedValue, 16) * (maxSize - minSize));
  };
  
  // Generate positions for words in a sphere-like shape
  const generatePositions = (count: number, wordsToUse: TagCloudWord[]): [number, number, number][] => {
    const positions: [number, number, number][] = [];
    
    // Special case for single word
    if (count === 1) {
      positions.push([0, 0, 0]);
      return positions;
    }
    
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle
    
    // First, generate initial positions on a larger sphere
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = phi * i;
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      // Scale to fit in a larger initial sphere
      positions.push([x * 8, y * 8, z * 8] as [number, number, number]);
    }
    
    // Get font sizes for all words to use in repulsion calculations
    const fontSizes = wordsToUse.map(word => getFontSize(word.value, wordsToUse));
    
    // Apply repulsion forces to adjust positions
    const iterations = 100; // More iterations for better separation
    const repulsionForce = 0.15; // Stronger repulsion
    
    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < positions.length; i++) {
        const pos1 = positions[i];
        let dx = 0, dy = 0, dz = 0;
        
        // Calculate repulsion from all other words
        for (let j = 0; j < positions.length; j++) {
          if (i === j) continue;
          
          const pos2 = positions[j];
          const distance = Math.sqrt(
            Math.pow(pos1[0] - pos2[0], 2) +
            Math.pow(pos1[1] - pos2[1], 2) +
            Math.pow(pos1[2] - pos2[2], 2)
          );
          
          // Calculate minimum distance based on both words' sizes
          const combinedSize = (fontSizes[i] + fontSizes[j]) * 3;
          const minDistance = Math.max(2, combinedSize);
          
          // Apply repulsion if words are too close
          if (distance < minDistance) {
            // Stronger repulsion for bigger words
            const force = (minDistance - distance) * repulsionForce * 
              (1 + Math.max(fontSizes[i], fontSizes[j]));
            
            dx += ((pos1[0] - pos2[0]) / distance) * force;
            dy += ((pos1[1] - pos2[1]) / distance) * force;
            dz += ((pos1[2] - pos2[2]) / distance) * force;
          }
        }
        
        // Update position with repulsion forces
        positions[i] = [
          pos1[0] + dx,
          pos1[1] + dy,
          pos1[2] + dz
        ] as [number, number, number];
        
        // Keep words within bounds
        const maxRadius = 12; // Larger maximum radius
        const dist = Math.sqrt(
          positions[i][0] * positions[i][0] +
          positions[i][1] * positions[i][1] +
          positions[i][2] * positions[i][2]
        );
        
        if (dist > maxRadius) {
          const scale = maxRadius / dist;
          positions[i] = [
            positions[i][0] * scale,
            positions[i][1] * scale,
            positions[i][2] * scale
          ] as [number, number, number];
        }
      }
    }
    
    return positions;
  };

  // Ensure words array is valid
  const validWords = Array.isArray(words) ? words : [];
  
  // Generate positions only if we have valid words
  const positions = validWords.length > 0 ? generatePositions(validWords.length, validWords) : [];
  
  // Return early if no valid words
  if (validWords.length === 0) {
    return null;
  }
  
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      {validWords.map((word, i) => (
        <Word
          key={word.text}
          word={word}
          position={positions[i] || [0, 0, 0]}
          fontSize={getFontSize(word.value, validWords)}
          color={getBiasColor(word.bias)}
          onClick={() => onWordClick(word)}
          isSelected={selectedWord === word.text}
          isNew={newWords.has(word.text)}
        />
      ))}
      
      <OrbitControls 
        enableZoom={true}
        enablePan={false}
        autoRotate={!isTimeMachineMode}
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
  currentTime: Date;
  isTimeMachineMode: boolean;
  words?: TagCloudWord[];
  onWordSelect?: (word: TagCloudWord) => void;
  selectedWord?: string | null;
}> = ({ 
  category, 
  currentTime, 
  isTimeMachineMode,
  words = [],
  onWordSelect,
  selectedWord = null
}) => {
  const [newWords, setNewWords] = useState<Set<string>>(new Set());
  const [prevWords, setPrevWords] = useState<Set<string>>(new Set());
  
  // Track new words
  useEffect(() => {
    const currentWordSet = new Set(words.map(w => w.text));
    const newWordsSet = new Set<string>();
    
    // Find words that weren't in the previous set
    currentWordSet.forEach(word => {
      if (!prevWords.has(word)) {
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
    setPrevWords(currentWordSet);
  }, [words, prevWords]);
  
  const handleWordClick = (word: TagCloudWord) => {
    if (onWordSelect) {
      onWordSelect(word);
    }
  };
  
  if (words.length === 0) {
    return <div className="tag-cloud-container loading">No data available for this time period.</div>;
  }
  
  return (
    <div className="tag-cloud-3d-container">
      <div className="status-indicator">
        {isTimeMachineMode ? (
          <span className="historical-indicator">
            Viewing historical data: {currentTime.toLocaleString()}
          </span>
        ) : (
          <span className="live-indicator">Live Updates</span>
        )}
      </div>
      
      <div className="tag-cloud-3d">
        <TagCloud3D 
          words={words} 
          onWordClick={handleWordClick} 
          selectedWord={selectedWord}
          newWords={newWords}
          isTimeMachineMode={isTimeMachineMode}
        />
      </div>
    </div>
  );
};

export default TagCloud3DContainer;
