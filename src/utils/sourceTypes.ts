import { SourceType, TagCloudWord } from '../types';

/**
 * The source type that dominates a word's coverage — the one with the
 * highest recency-weighted mention total. This drives both the tag's font
 * and the source-type filters, so what you see is what the filter matches.
 * Falls back to the first listed type for words from an older cache
 * without typeWeights.
 */
export const getDominantSourceType = (word: Pick<TagCloudWord, 'types' | 'typeWeights'>): SourceType => {
  const weights = word.typeWeights;
  if (weights && Object.keys(weights).length > 0) {
    let dominant: SourceType = SourceType.Unknown;
    let max = -Infinity;
    Object.entries(weights).forEach(([type, weight]) => {
      if (weight > max) {
        max = weight;
        dominant = type as SourceType;
      }
    });
    return dominant;
  }
  if (word.types && word.types.length > 0) return word.types[0];
  return SourceType.Unknown;
};
