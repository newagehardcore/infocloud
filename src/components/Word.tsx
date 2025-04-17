import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TagCloudWord } from '../types';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { getTagFont } from '../utils/fonts';

// Optimized Word component for the 3D tag cloud
export const Word: React.FC<{ 
  word: TagCloudWord; 
  position: [number, number, number]; 
  fontSize: number; 
  color: string; 
  onClick: () => void; 
  isSelected: boolean;
  isNew: boolean;
  animationSpeed?: number;
  useSimpleRendering?: boolean;
}> = ({ 
  word, 
  position, 
  fontSize, 
  color, 
  onClick, 
  isSelected, 
  isNew,
  animationSpeed = 1,
  useSimpleRendering = false
}) => {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();
  
  // Store the initial position
  const initialPosition = useMemo((): [number, number, number] => {
    return position && Array.isArray(position) && position.length === 3
      ? [position[0], position[1], position[2]]
      : [0, 0, 0];
  }, [position]);
  
  // Generate deterministic animation parameters based on word text
  const animParams = useMemo(() => {
    let hash = 5381;
    for (let i = 0; i < word.text.length; i++) {
      hash = ((hash << 5) + hash) + word.text.charCodeAt(i);
    }
    
    // Create unique but stable frequencies for this word
    const uniqueOffset = Math.sin(hash * 0.1) * 10;
    return {
      xFreq: 0.2 + Math.sin(hash * 0.05) * 0.1,
      yFreq: 0.25 + Math.cos(hash * 0.05) * 0.1,
      zFreq: 0.3 + Math.sin(hash * 0.05) * 0.1,
      offset: uniqueOffset
    };
  }, [word.text]);
  
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
      initialPosition[0] + Math.sin(time * animParams.xFreq + animParams.offset) * floatAmount,
      initialPosition[1] + Math.cos(time * animParams.yFreq + animParams.offset) * floatAmount,
      initialPosition[2] + Math.sin(time * animParams.zFreq + animParams.offset) * floatAmount
    );
  });
  
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
        onPointerDown={e => {
          e.stopPropagation();
          onClick();
        }}
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
