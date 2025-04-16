import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { TagCloudWord, PoliticalBias } from '../types';
import { Word } from './Word';
import * as THREE from 'three';

// Random starfield component that displays words randomly distributed
// Biases: 'mainstream-democrat', 'alternative-left', 'centrist', 'mainstream-republican', 'alternative-right', 'unclear'
const StarfieldTags: React.FC<{
  words: TagCloudWord[];
  positions: [number, number, number][];
  onWordClick: (word: TagCloudWord) => void;
  selectedWord: string | null;
  newWords: Set<string>;
  getFontSize: (value: number) => number;
  getBiasColor: (bias: PoliticalBias) => string;
  renderSettings: any;
}> = ({ words, positions, onWordClick, selectedWord, newWords, getFontSize, getBiasColor, renderSettings }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Ensure we have valid positions for all words
  const validPositions = positions.length >= words.length ? 
    positions : 
    Array(words.length).fill([0, 0, 0]);

  // Defensive: filter out words with null/undefined/empty text
  const safeWords = words.filter(w => typeof w.text === 'string' && w.text.trim() !== '');

  // Add gentle continuous movement
  useFrame((state) => {
    if (!groupRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Individual word movement
    safeWords.forEach((_, index) => {
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

  // Add logging for words being rendered by bias
  React.useEffect(() => {
    if (safeWords.length > 0) {
      console.log(`StarfieldTags rendering ${safeWords.length} words with bias distribution:`, 
        safeWords.reduce((acc, word) => {
          acc[word.bias] = (acc[word.bias] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));
    }
  }, [safeWords]);

  return (
    <group ref={groupRef}>
      {safeWords.map((word, i) => (
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

export default StarfieldTags; 