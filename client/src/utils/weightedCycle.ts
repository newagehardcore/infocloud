// Shared helper for the tag cloud's continuous bias-color and source-type-
// font cycling: given a set of weighted keys (a word's biasWeights or
// typeWeights), builds a repeating timeline where each key occupies an arc
// of the cycle proportional to its weight share. The display holds at that
// key's pure value for the first half of its arc, then eases into the NEXT
// key for the back half - so it continuously fades between whatever's
// represented, spending the most time on (and returning to pure state most
// often at) whichever is most heavily weighted, and never jump-cutting.

export interface WeightedCyclePosition {
  current: string;
  next: string;
  blendT: number; // 0 = fully "current", 1 = fully "next"
}

// Deterministic per-word phase offset (0-1) so different words' cycles
// don't all move in lockstep. `salt` lets the same word get independent
// offsets for unrelated cycles (e.g. bias color vs. type font).
export function hashStringToUnit(str: string, salt: number = 0): number {
  let hash = 5381 + salt;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (Math.abs(hash) % 10000) / 10000;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function getWeightedCyclePosition(
  weights: Record<string, number> | undefined,
  fallbackKey: string,
  time: number,
  cycleDurationSeconds: number,
  phaseOffset: number
): WeightedCyclePosition {
  const entries = weights ? Object.entries(weights).filter(([, w]) => w > 0) : [];
  if (entries.length === 0) {
    return { current: fallbackKey, next: fallbackKey, blendT: 0 };
  }
  if (entries.length === 1) {
    return { current: entries[0][0], next: entries[0][0], blendT: 0 };
  }

  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  // Stable order (weight desc, then key) so segment layout can't jitter
  // frame-to-frame just because of Object.entries' ordering.
  const sorted = entries
    .map(([key, w]) => [key, w / total] as [string, number])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  let cumulative = 0;
  const segments = sorted.map(([key, w]) => {
    const start = cumulative;
    cumulative += w;
    return { key, start, end: cumulative };
  });

  const phase = (((time + phaseOffset * cycleDurationSeconds) % cycleDurationSeconds) / cycleDurationSeconds + 1) % 1;

  let idx = segments.findIndex(s => phase >= s.start && phase < s.end);
  if (idx === -1) idx = segments.length - 1;
  const currentSeg = segments[idx];
  const nextSeg = segments[(idx + 1) % segments.length];

  const span = currentSeg.end - currentSeg.start || 1;
  const localT = (phase - currentSeg.start) / span;
  // Hold the pure value for the first half of this segment's arc; only ease
  // toward the next one in the back half.
  const blendT = smoothstep(0.5, 1, localT);

  return { current: currentSeg.key, next: nextSeg.key, blendT };
}
