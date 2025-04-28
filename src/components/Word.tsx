import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree, ThreeEvent, extend } from '@react-three/fiber';
import { TagCloudWord } from '../types';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { getTagFont } from '../utils/fonts';
import { Group, Mesh, SphereGeometry, MeshBasicMaterial } from 'three';

extend({ SphereGeometry, MeshBasicMaterial });

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
    
    // Grow animation for new words
    if (isNew && ref.current.scale.x < 1) {
      ref.current.scale.x += delta * 2 * animationSpeed;
      ref.current.scale.y += delta * 2 * animationSpeed;
      ref.current.scale.z += delta * 2 * animationSpeed;
    }
    
    // Hover and selection effects
    const targetScale = (hovered || isSelected) ? 1.2 : 1;
    ref.current.scale.x = THREE.MathUtils.lerp(ref.current.scale.x, targetScale, delta * 5 * animationSpeed);
    ref.current.scale.y = THREE.MathUtils.lerp(ref.current.scale.y, targetScale, delta * 5 * animationSpeed);
    ref.current.scale.z = THREE.MathUtils.lerp(ref.current.scale.z, targetScale, delta * 5 * animationSpeed);
    
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
        fontSize={fontSize}
        color={color}
        font={getTagFont()}
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
          <sphereGeometry args={[fontSize * 0.6, useSimpleRendering ? 8 : 16, useSimpleRendering ? 8 : 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  );
};
