import { PoliticalBias, SourceType, TagCloudWord } from '../types';

const heaviestKey = (weights: { [key: string]: number } | undefined): string | null => {
  if (!weights) return null;
  let best: string | null = null;
  let max = -Infinity;
  Object.entries(weights).forEach(([key, weight]) => {
    if (weight > max) {
      max = weight;
      best = key;
    }
  });
  return best;
};

/**
 * The source type that dominates a word's coverage — the one with the
 * highest recency-weighted mention total. This drives both the tag's font
 * and the source-type filters, so what you see is what the filter matches.
 * Falls back to the first listed type for words from an older cache
 * without typeWeights.
 */
export const getDominantSourceType = (word: Pick<TagCloudWord, 'types' | 'typeWeights'>): SourceType => {
  const dominant = heaviestKey(word.typeWeights);
  if (dominant) return dominant as SourceType;
  if (word.types && word.types.length > 0) return word.types[0];
  return SourceType.Unknown;
};

/**
 * The bias that dominates a word's coverage, by recency-weighted mention
 * total. Drives both the tag's color and the bias filters — soloing Left
 * shows only the words rendered in the Left color.
 */
export const getDominantBias = (word: Pick<TagCloudWord, 'biases' | 'biasWeights'>): PoliticalBias => {
  const dominant = heaviestKey(word.biasWeights);
  if (dominant) return dominant as PoliticalBias;
  if (word.biases && word.biases.length > 0) return word.biases[0];
  return PoliticalBias.Unknown;
};
