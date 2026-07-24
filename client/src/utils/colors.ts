import { PoliticalBias } from '../types';

// Shared with TagCloud3DOptimized.tsx (word coloring) and Word.tsx (per-frame
// bias-color cycling) - single source of truth for the bias -> color mapping.
export const getBiasColorHex = (bias: PoliticalBias): string => {
  switch (bias) {
    case PoliticalBias.Left:
      return '#0000FF';
    case PoliticalBias.Liberal:
      return '#6495ED';
    case PoliticalBias.Centrist:
      return '#800080';
    case PoliticalBias.Conservative:
      return '#FFB6C1';
    case PoliticalBias.Right:
      return '#FF0000';
    case PoliticalBias.Unknown:
    default:
      return '#808080';
  }
};
