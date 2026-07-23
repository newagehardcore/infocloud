import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree, ThreeEvent, extend } from '@react-three/fiber';
import { TagCloudWord, SourceType } from '../types';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { getTagFont } from '../utils/fonts';
import { getDominantSourceType } from '../utils/dominance';
import { Group, Mesh, SphereGeometry, MeshBasicMaterial } from 'three';

extend({ SphereGeometry, MeshBasicMaterial });

// The Text glyph geometry is generated once at this fixed size; the actual
// on-screen size (which now depends on the current category/bias/type
// filter, and can shift as coverage evolves) is represented purely via the
// group's `scale` transform below, which is already smoothly lerped every
// frame. Changing `fontSize` directly would force drei to regenerate glyph
// geometry - expensive, and the sudden re-layout is what read as a "pop" or
// contributed to frame hitches when many words resized at once. Routing
// size through scale means a resize is just a transform update: cheap,
// smooth, and never touches geometry after the word first mounts.
const BASE_TEXT_SIZE = 1;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      sphereGeometry: any;
      meshBasicMaterial: any;
    }
  }
}

// Optimized Word component for the 3D tag cloud
export const Word = ({ 
  word, 
  position, 
  fontSize, 
  color, 
  onClick, 
  isSelected, 
  isNew,
  animationSpeed = 1,
  useSimpleRendering = false
}: { 
  word: TagCloudWord; 
  position: [number, number, number]; 
  fontSize: number; 
  color: string; 
  onClick: (word: TagCloudWord, position: { top: number; left: number }) => void; 
  isSelected: boolean;
  isNew: boolean;
  animationSpeed?: number;
  useSimpleRendering?: boolean;
}) => {
  const ref = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const { camera, size } = useThree();
  
  // Determine the dominant source type for this word
  const dominantSourceType = useMemo(() => getDominantSourceType(word), [word]);
  
  // Store the initial position
  const initialPosition = useMemo((): [number, number, number] => {
    return position && Array.isArray(position) && position.length === 3
      ? [position[0], position[1], position[2]]
      : [0, 0, 0];
  }, [position]);
  
  // Animation for new words
  useEffect(() => {
    if (ref.current && isNew) {
      ref.current.scale.set(0, 0, 0);
    }
  }, [isNew]);
  
  // Frame animation with performance optimizations
  useFrame((state, delta) => {
    if (!ref.current) return;
    
    // Always face the camera (billboarding) with upright orientation
    ref.current.quaternion.copy(camera.quaternion);

    // Target scale combines the word's current desired size (which can
    // change as the category/bias/type filter changes, or as coverage
    // grows/shrinks) with the hover/selection pulse. A brand new word starts
    // from scale 0 (set in the mount effect below) and grows into this same
    // target via the lerp just like any other size change - no separate
    // growth branch needed.
    // IMPORTANT: clamp the lerp factor to 1 — a janky frame (delta > 0.2s,
    // common on initial load while text glyphs generate) would otherwise make
    // lerp extrapolate past the target and diverge exponentially (scales in
    // the billions → black screen / one giant glyph filling the viewport).
    const hoverMultiplier = (hovered || isSelected) ? 1.2 : 1;
    const targetScale = fontSize * hoverMultiplier;
    const t = Math.min(1, delta * 5 * animationSpeed);
    ref.current.scale.x = THREE.MathUtils.lerp(ref.current.scale.x, targetScale, t);
    ref.current.scale.y = THREE.MathUtils.lerp(ref.current.scale.y, targetScale, t);
    ref.current.scale.z = THREE.MathUtils.lerp(ref.current.scale.z, targetScale, t);
    
    // Apply gentle floating movement
    const time = state.clock.getElapsedTime();
    const floatAmount = 0.15; // Reduced float amount for subtler movement
    
    // Use the stored initial position for the floating animation
    ref.current.position.set(
      initialPosition[0] + Math.sin(time * 0.2 + 0) * floatAmount,
      initialPosition[1] + Math.cos(time * 0.25 + 0) * floatAmount,
      initialPosition[2] + Math.sin(time * 0.3 + 0) * floatAmount
    );
  });

  const handleClick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!ref.current) return;

    // Get the world position of the word
    const worldPosition = new THREE.Vector3();
    ref.current.getWorldPosition(worldPosition);

    // Project to screen coordinates
    const vector = worldPosition.project(camera);

    // Convert to screen coordinates
    const screenX = (vector.x + 1) / 2 * size.width;
    const screenY = (-vector.y + 1) / 2 * size.height;

    onClick(word, { top: screenY, left: screenX });
  };
  
  return (
    <group
      ref={ref}
      position={initialPosition}
    >
      <Text
        fontSize={BASE_TEXT_SIZE}
        color={color}
        font={getTagFont(dominantSourceType)}
        anchorX="center"
        anchorY="middle"
        outlineWidth={isSelected ? 0.02 : 0}
        outlineColor="#fff"
        letterSpacing={-0.03}
        fontWeight={600}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={handleClick}
        characters="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?&@#$%()[]{}"
      >
        {word.text}
      </Text>
      {isNew && !useSimpleRendering && (
        <mesh>
          {/* Fixed base radius: this mesh is a child of the group, so it's
              already scaled by the same fontSize-driven transform as the
              Text above - a fontSize-dependent radius here would double up
              and grow quadratically instead of matching the text size. */}
          <sphereGeometry args={[BASE_TEXT_SIZE * 0.6, useSimpleRendering ? 8 : 16, useSimpleRendering ? 8 : 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  );
};
