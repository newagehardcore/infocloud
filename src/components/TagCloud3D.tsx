import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, OrbitControls } from '@react-three/drei';
import { NewsCategory, TagCloudWord, NewsItem } from '../types';
import * as THREE from 'three';
import './TagCloud3D.css';
import { getTagFont } from '../utils/fonts';

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
  
  // Animation for new words
  useEffect(() => {
    if (ref.current && isNew) {
      ref.current.scale.set(0, 0, 0);
    }
  }, [isNew]);
  
  // Frame animation
  useFrame((state, delta) => {
    if (!ref.current) return;
    
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
    
    // Subtle floating animation
    ref.current.position.y += Math.sin(state.clock.elapsedTime * 0.5 + position[0] * 100) * 0.01;
  });
  
  return (
    <mesh
      ref={ref}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <Text
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={isSelected ? 0.02 : 0}
        outlineColor="#ffffff"
        font={getTagFont()}
        letterSpacing={-0.03}
        fontWeight="normal"
      >
        {word.text}
      </Text>
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
      case 'mainstream-left': return '#6495ED'; // Pale blue
      case 'alternative-left': return '#0000FF'; // Bright blue
      case 'centrist': return '#800080'; // Purple
      case 'mainstream-right': return '#F08080'; // Pale red
      case 'alternative-right': return '#FF0000'; // Bright red
      default: return '#808080'; // Gray for unclear
    }
  };
  
  // Calculate font size based on word frequency
  const getFontSize = (value: number): number => {
    const minSize = 0.01; // Extremely tiny for least frequent words
    const maxSize = 1.0;  // Large maximum for frequent words
    const maxValue = Math.max(...words.map(w => w.value), 1);
    
    // Use a non-linear scale with a higher power for extreme differentiation
    const normalizedValue = value / maxValue;
    
    // Apply a power curve with power of 4 for even more dramatic difference
    // This creates an extremely long tail of small words with only the most frequent being large
    return minSize + (Math.pow(normalizedValue, 4) * (maxSize - minSize));
  };
  
  // Generate positions for words in a sphere-like shape
  const generatePositions = (count: number): [number, number, number][] => {
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
  };
  
  const positions = generatePositions(words.length);
  
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      {words.map((word, i) => (
        <Word
          key={word.text}
          word={word}
          position={positions[i]}
          fontSize={getFontSize(word.value)}
          color={getBiasColor(word.bias)}
          onClick={() => onWordClick(word)}
          isSelected={selectedWord === word.text}
          isNew={newWords.has(word.text)}
        />
      ))}
      
      <OrbitControls 
        enableZoom={true}
        enablePan={false}
        autoRotate={!isTimeMachineMode} // Only auto-rotate in live mode
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
