import React from 'react';
import { TagCloudWord, PoliticalBias } from '../types';
import { Word } from './Word';
import * as THREE from 'three';

// Re-add constant definition here as it's used for fallback
const MIN_FONT_SIZE = 0.2;

// Random starfield component that displays words randomly distributed
// Biases: 'mainstream-democrat', 'alternative-left', 'centrist', 'mainstream-republican', 'alternative-right', 'unclear'
const StarfieldTags: React.FC<{
  words: TagCloudWord[];
  positions: [number, number, number][];
  onWordClick: (word: TagCloudWord, position: { top: number; left: number }) => void;
  selectedWord: string | null;
  newWords: Set<string>;
  fontSizes: Map<string, number>;
  getBiasColor: (bias: PoliticalBias) => string;
  renderSettings: any;
}> = ({ words, positions, onWordClick, selectedWord, newWords, fontSizes, getBiasColor, renderSettings }) => {
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
          fontSize={fontSizes.get(word.text) ?? MIN_FONT_SIZE}
          color={getBiasColor(word.biases && word.biases.length > 0 ? word.biases[0] : PoliticalBias.Unknown)}
          onClick={onWordClick}
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