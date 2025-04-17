import React from 'react';
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
  // Defensive: filter out words with null/undefined/empty text first
  const safeWords = words.filter(w => typeof w.text === 'string' && w.text.trim() !== '');
  
  // Ensure we have valid positions for all words
  const validPositions = safeWords.map((_, index) => {
    if (index < positions.length) {
      return positions[index];
    }
    // Fallback position if no position is provided
    return [0, 0, 0] as [number, number, number];
  });

  return (
    <group>
      {safeWords.map((word, i) => (
        <Word
          key={`${word.text}-${i}`}
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