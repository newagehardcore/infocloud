import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { NewsCategory, TagCloudWord, PoliticalBias } from '../types';
import { throttle, getAdaptiveRenderingSettings, PerformanceMonitor } from '../utils/performance';
import './TagCloud3D.css';
import StarfieldTags from './StarfieldTags';

// Define min/max size constants
const MIN_FONT_SIZE = 0.5; // Adjusted slightly larger minimum
const MAX_FONT_SIZE = 4.5;
// Size is normalized against the LOCAL min/max of the currently displayed
// set (i.e. within whatever category/bias/type filter is active), not a
// fixed global anchor - so filtering into a thin category still shows a
// clear "biggest word" instead of everything looking uniformly small. This
// is deliberately NOT rank-based though: it compares each word's actual
// value to the local range, so two nearly-tied words still render at nearly
// the same size, rather than the old rank scheme where tiny reorderings of
// near-ties produced big, arbitrary size swings.
//
// The interpolation is done in LOG space, not linear. Word values are
// heavily power-law distributed - e.g. on the "all" view one story can sit
// at 2x the runner-up and 100x the tail. A linear ratio-to-the-Nth-power
// crushes that: the runner-up's ratio is already small, and raising a small
// number to a power crushes it further, so everything except the #1 word
// collapses into a flat floor.
//
// The exponent applied on top of the log-normalized t is a tradeoff between
// two failure modes seen in practice:
//   - too high (was 7 at one point) crushes almost everything toward the
//     floor except the single #1 word - "one giant word, flat sea of tiny
//     ones".
//   - too low (was 1.3) barely bends the curve at all, so most of the
//     upper/mid tail lands within a hair of MAX_FONT_SIZE - "everything
//     looks like a hero word, no medium tier".
// 2.5 is the middle ground: #1 stays clearly biggest, the runner-up(s) read
// as clearly-large-but-smaller, and the long tail falls off through
// medium/small/tiny rather than either collapsing or bunching at the top.
const VALUE_SCALE_EXPONENT = 2.5; // >1 keeps the "a couple hero words" look without flattening the rest

// Watchdog inside the Canvas: r3f's "always" frameloop can die on initial
// mount (rAF chain breaks); invalidate() restarts it if no frame has run recently.
const FrameloopWatchdog: React.FC = () => {
  const invalidate = useThree(state => state.invalidate);
  const clock = useThree(state => state.clock);
  useEffect(() => {
    // r3f's render loop stops when no root needs frames, and the mount-time
    // invalidate can fire before the root is activated (returning early) —
    // leaving frameloop="always" permanently stalled until some interaction
    // invalidates again. Nudge it whenever the clock stops advancing.
    // invalidate() alone is not always enough (it no-ops while the store is
    // inactive, which happens in production builds), so if the clock is STILL
    // stuck after a long stretch, fake a window resize — r3f's measure/resize
    // path unconditionally restarts the loop.
    //
    // The escalation threshold used to be 1s (2 checks), which was far too
    // eager: forcing a resize makes the browser reallocate the WebGL drawing
    // buffer, and that reallocation is exactly what shows up as a visible
    // "THREE.WebGLRenderer: Context Lost" / "Context Restored" flash. Normal,
    // brief main-thread busy periods (e.g. the news popup's mount animation)
    // were enough to trip a 1s threshold, causing a self-inflicted flicker on
    // essentially every tag click. 10s only fires for a genuinely stuck loop.
    let lastElapsed = -1;
    let stuckChecks = 0;
    const id = setInterval(() => {
      if (clock.elapsedTime === lastElapsed) {
        stuckChecks += 1;
        invalidate();
        if (stuckChecks >= 20) {
          window.dispatchEvent(new Event('resize'));
          stuckChecks = 0;
        }
      } else {
        stuckChecks = 0;
      }
      lastElapsed = clock.elapsedTime;
    }, 500);
    return () => clearInterval(id);
  }, [invalidate, clock]);
  return null;
};

// Main tag cloud component with performance optimizations
const TagCloud3D: React.FC<{
  words: TagCloudWord[];
  onWordClick: (word: TagCloudWord, position: { top: number; left: number }) => void;
  selectedWord: string | null;
  newWords: Set<string>;
}> = ({ words, onWordClick, selectedWord, newWords }) => {
  const [renderSettings, setRenderSettings] = useState(getAdaptiveRenderingSettings());
  
  // Get color based on political bias
  const getBiasColor = useCallback((bias: PoliticalBias): string => {
    switch (bias) {
      case PoliticalBias.Left:
        return '#0000FF'; // Bright blue
      case PoliticalBias.Liberal:
        return '#6495ED'; // Light blue
      case PoliticalBias.Centrist:
        return '#800080'; // Purple
      case PoliticalBias.Conservative:
        return '#FFB6C1'; // Light red
      case PoliticalBias.Right:
        return '#FF0000'; // Bright red
      case PoliticalBias.Unknown:
      default:
        return '#808080'; // Grey
    }
  }, []);
  
  // Calculate all font sizes from each word's value relative to the local
  // max, synchronously with the words. (useMemo, not effect state:
  // positions/sizes must never lag one render behind `words`, or a large
  // word briefly renders at another word's near-camera slot — the "white
  // flash" on category switch.) The resulting number is consumed as a scale
  // multiplier, not a literal glyph fontSize (see Word.tsx) - actual size
  // changes are animated smoothly there instead of snapping instantly.
  const fontSizes = React.useMemo(() => {
    const newFontSizes = new Map<string, number>();
    if (words.length === 0) return newFontSizes;

    const values = words.map(w => Math.max(w.value, 1e-6));
    const localMax = Math.max(...values);
    const localMin = Math.min(...values);
    const logMax = Math.log(localMax);
    const logMin = Math.log(localMin);
    const logRange = logMax - logMin;

    words.forEach(word => {
      const value = Math.max(word.value, 1e-6);
      // logRange can be 0 when every visible word has the same value (or
      // there's only one word) - fall back to the max size rather than
      // dividing by zero.
      const t = logRange > 0 ? Math.min(1, Math.max(0, (Math.log(value) - logMin) / logRange)) : 1;
      const fontSize = MIN_FONT_SIZE + Math.pow(t, VALUE_SCALE_EXPONENT) * (MAX_FONT_SIZE - MIN_FONT_SIZE);
      newFontSizes.set(word.text, fontSize);
    });
    return newFontSizes;
  }, [words]);
  
  // Deterministic position generator based on word text
  const hashStringToSeed = useCallback((str: string): number => {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    }
    return Math.abs(hash);
  }, []);

  // Positions are cached per word-text in a ref that persists across
  // renders, and only ever gain entries for words that don't have one yet.
  // This is what makes "adding a tag shouldn't move any other tag, and an
  // existing tag growing shouldn't move either" actually true: a word's
  // position is computed once, from its own hash and the state of the
  // world at the moment it first appears, and is never recalculated just
  // because some other word's value/rank changed on a later refresh.
  const positionCacheRef = useRef<Map<string, [number, number, number]>>(new Map());

  // Generate positions with frequency-based clustering
  const generateDeterministicPositions = useCallback((words: TagCloudWord[]): [number, number, number][] => {
    const CLOUD_SIZE = 30; // Smaller base size for tighter clustering
    const DEPTH_FACTOR = 1.5; // Reduced depth range
    const MAX_RADIUS = 28; // Clamp shell so no word can sit near the camera
    const MAX_DEPTH = 20; // (camera is at z=60; an unclamped word at z~45 fills the viewport)

    const cache = positionCacheRef.current;
    const maxValue = Math.max(...words.map(w => w.value), 1);

    const clampPosition = (pos: [number, number, number]): [number, number, number] => {
      let [x, y, z] = pos;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return [0, 0, 0];
      }
      const r = Math.sqrt(x * x + y * y + z * z);
      if (r > MAX_RADIUS) {
        const s = MAX_RADIUS / r;
        x *= s; y *= s; z *= s;
      }
      z = Math.max(-MAX_DEPTH, Math.min(MAX_DEPTH, z));
      return [x, y, z];
    };

    function generatePositionForWord(word: TagCloudWord, radiusMultiplier: number = 1): [number, number, number] {
      const seed = hashStringToSeed(word.text);

      // Normalize word frequency to 0-1 range (FOR POSITIONING ONLY)
      const frequencyFactor = word.value / maxValue;
      // Invert and dampen the frequency factor (high frequency = further from center for large words)
      const distanceFactor = Math.pow(1 - frequencyFactor, 0.5);

      // For higher frequency words (larger ones), push them slightly further out
      const highFrequencyFactor = frequencyFactor > 0.5 ? 0.3 + frequencyFactor * 0.4 : 0;

      const baseRadius = (((seed % 9973) / 9973) * 0.8 + 0.2) * // Random base 0.2-1.0
                      CLOUD_SIZE *
                      (0.2 + distanceFactor * 0.8 + highFrequencyFactor) * // Scale by frequency with extra factor for large words
                      radiusMultiplier; // Apply any radius multiplier

      const goldenRatio = 1.618033988749895;
      const i = seed % 500;

      const theta = i * goldenRatio * Math.PI * 2;
      const phi = Math.acos(1 - 2 * ((seed % 997) / 997));

      const zNoise = ((seed >> 5) % 997) / 997 - 0.5;

      const x = baseRadius * Math.sin(phi) * Math.cos(theta);
      const y = baseRadius * Math.cos(phi);
      const z = (baseRadius * Math.sin(phi) * Math.sin(theta) + zNoise * 5) * DEPTH_FACTOR;

      return [x, y, z];
    }

    // Process largest-first so a brand new large word can check against
    // both already-placed large words (from the cache) and newly-placed
    // ones earlier in this same pass.
    const sortedWords = [...words].sort((a, b) => b.value - a.value);

    const largeWordPositions: { position: [number, number, number]; size: number }[] = [];
    sortedWords.forEach(word => {
      const cached = cache.get(word.text);
      if (cached && word.value / maxValue > 0.5) {
        largeWordPositions.push({ position: cached, size: fontSizes.get(word.text) || MIN_FONT_SIZE });
      }
    });

    sortedWords.forEach(word => {
      if (cache.has(word.text)) return; // already placed - never moves again

      const isLargeWord = word.value / maxValue > 0.5;
      let position = generatePositionForWord(word);

      // For large words, ensure minimum distance from other large words
      if (isLargeWord && largeWordPositions.length > 0) {
        const fontSize = fontSizes.get(word.text) || MIN_FONT_SIZE;

        // Try repositioning up to 5 times to avoid overlaps
        for (let attempts = 0; attempts < 5; attempts++) {
          let tooClose = false;
          for (const existing of largeWordPositions) {
            const combinedSize = fontSize + existing.size;
            const minDistance = combinedSize * 0.8; // Minimum distance as a factor of combined size
            const distance = Math.sqrt(
              Math.pow(position[0] - existing.position[0], 2) +
              Math.pow(position[1] - existing.position[1], 2) +
              Math.pow(position[2] - existing.position[2], 2)
            );
            if (distance < minDistance) {
              tooClose = true;
              break;
            }
          }
          if (!tooClose) break; // Position is good
          position = generatePositionForWord(word, 1.2 + attempts * 0.3);
        }

        largeWordPositions.push({ position, size: fontSize });
      }

      cache.set(word.text, clampPosition(position));
    });

    // Drop cache entries for words no longer present, so a long session
    // doesn't accumulate every tag ever seen - a word that ages out and
    // later comes back just gets a fresh spot rather than a stale one.
    const currentTexts = new Set(words.map(w => w.text));
    Array.from(cache.keys()).forEach(text => {
      if (!currentTexts.has(text)) cache.delete(text);
    });

    return words.map(word => cache.get(word.text) || [0, 0, 0]);
  }, [hashStringToSeed, fontSizes]);

  // Positions computed synchronously with words + fontSizes (see note above)
  const positions = React.useMemo(
    () => (words.length > 0 ? generateDeterministicPositions(words) : []),
    [words, generateDeterministicPositions]
  );
  
  // Initialize performance monitor
  useEffect(() => {
    const monitor = new PerformanceMonitor((currentFps) => {
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
      setRenderSettings(getAdaptiveRenderingSettings());
    }, 500);
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Debug log when words change
  useEffect(() => {
    if (words.length > 0) {
      console.log(`TagCloud3D received ${words.length} words. Sample biases (first word):`, 
        words[0]?.biases); // Log the biases array of the first word
      // Example of how to count occurrences of each bias across all words:
      const biasCounts = words.reduce((acc, word) => {
        if (word.biases) {
          word.biases.forEach(b => {
            acc[b] = (acc[b] || 0) + 1;
          });
        }
        return acc;
      }, {} as Record<PoliticalBias, number>);
      console.log('Bias distribution:', biasCounts);
    }
  }, [words]);
  
  return (
    <Canvas 
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      camera={{ 
        position: [0, 0, 60],
        fov: 45,
        near: 0.1,
        far: 1000
      }}
      dpr={renderSettings.pixelRatio}
      performance={{ min: 0.5 }}
    >
      <FrameloopWatchdog />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      <StarfieldTags
        words={words}
        positions={positions}
        onWordClick={onWordClick}
        selectedWord={selectedWord}
        newWords={newWords}
        fontSizes={fontSizes}
        getBiasColor={getBiasColor}
        renderSettings={renderSettings}
      />
      
      <OrbitControls
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        autoRotate={true}
        autoRotateSpeed={0.05}
        minDistance={0.1}
        maxDistance={200}
        enableDamping={true}
        dampingFactor={0.005}
        rotateSpeed={5.05}
        zoomSpeed={1.2}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
      />
    </Canvas>
  );
};

// Container component that might handle loading or context
const TagCloud3DContainer: React.FC<{
  category: NewsCategory | 'all'; // Allow 'all' for category prop
  words?: TagCloudWord[];
  onWordSelect?: (word: TagCloudWord, position: { top: number; left: number }) => void;
  selectedWord?: string | null;
}> = ({ 
  category, 
  words = [],
  onWordSelect,
  selectedWord = null
}) => {
  // TODO: Handle the 'all' category case if needed for specific logic here
  // For now, we just accept the type. It might be used for fetching or passed down.
  
  // Use a state for newWords set to track animations
  const [newWords, setNewWords] = useState<Set<string>>(new Set());
  const prevWordsRef = useRef<TagCloudWord[]>([]);

  // Defer mounting the Canvas until the first words arrive. Mounting it while
  // the app is mid-load (loading-bar interval re-rendering the tree every
  // 30ms) can permanently break r3f's initialization — the scene never
  // commits and the cloud stays blank until a resize/click.
  const [canvasReady, setCanvasReady] = useState(false);
  useEffect(() => {
    if (!canvasReady && words.length > 0) {
      const t = setTimeout(() => setCanvasReady(true), 150);
      return () => clearTimeout(t);
    }
  }, [canvasReady, words]);

  // Kick r3f awake after the Canvas mounts. In production builds the first
  // commit can stall (scene stays blank, in-canvas watchdog never mounts, so
  // it can't help); a synthetic window resize re-runs r3f's measure path,
  // which unconditionally restarts the loop. Fire a few times then stop.
  useEffect(() => {
    if (!canvasReady) return;
    const timers = [400, 1200, 2500, 5000].map(ms =>
      setTimeout(() => window.dispatchEvent(new Event('resize')), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [canvasReady]);

  // Detect new words when the words prop changes
  useEffect(() => {
    const currentWordTexts = new Set(words.map(w => w.text));
    const prevWordTexts = new Set(prevWordsRef.current.map(w => w.text));
    const newlyAdded = new Set<string>();

    currentWordTexts.forEach(text => {
      if (!prevWordTexts.has(text)) {
        newlyAdded.add(text);
      }
    });

    setNewWords(newlyAdded);
    prevWordsRef.current = words; // Update previous words for next comparison
    
    // Optional: Clear the 'new' status after animation duration (e.g., 1 second)
    // const timer = setTimeout(() => setNewWords(new Set()), 1000);
    // return () => clearTimeout(timer);

  }, [words]);
  
  // Handle word click event
  const handleWordClick = (word: TagCloudWord, position: { top: number; left: number }) => {
    if (onWordSelect) {
      onWordSelect(word, position);
    }
  };
  
  // Render the actual TagCloud3D component, passing down props
  if (!canvasReady) return null;
  return (
    <TagCloud3D
      words={words}
      onWordClick={handleWordClick}
      selectedWord={selectedWord}
      newWords={newWords} // Pass the set of new words
    />
  );
};

// Memoized: parent (App) re-renders at high frequency during the loading
// animation, and re-rendering the Canvas while r3f is initializing prevents
// its content from ever mounting (blank cloud until a resize/click).
export default React.memo(TagCloud3DContainer);
