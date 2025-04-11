import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { TagCloudWord } from '../types';
import * as THREE from 'three';

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
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();
  
  // Animation for new words
  useEffect(() => {
    if (ref.current && isNew) {
      ref.current.scale.set(0, 0, 0);
    }
  }, [isNew]);
  
  // Frame animation with performance optimizations
  useFrame((state, delta) => {
    if (!ref.current) return;
    
    // Always face the camera (billboarding)
    ref.current.quaternion.copy(camera.quaternion);
    
    // Grow animation for new words
    if (isNew && ref.current.scale.x < 1) {
      ref.current.scale.x += delta * 2 * animationSpeed;
      ref.current.scale.y += delta * 2 * animationSpeed;
      ref.current.scale.z += delta * 2 * animationSpeed;
    }
    
    // Hover and selection effects
    if (hovered || isSelected) {
      ref.current.scale.x = THREE.MathUtils.lerp(ref.current.scale.x, 1.2, delta * 5 * animationSpeed);
      ref.current.scale.y = THREE.MathUtils.lerp(ref.current.scale.y, 1.2, delta * 5 * animationSpeed);
      ref.current.scale.z = THREE.MathUtils.lerp(ref.current.scale.z, 1.2, delta * 5 * animationSpeed);
    } else {
      ref.current.scale.x = THREE.MathUtils.lerp(ref.current.scale.x, 1, delta * 5 * animationSpeed);
      ref.current.scale.y = THREE.MathUtils.lerp(ref.current.scale.y, 1, delta * 5 * animationSpeed);
      ref.current.scale.z = THREE.MathUtils.lerp(ref.current.scale.z, 1, delta * 5 * animationSpeed);
    }
    
    // Subtle floating animation - only if not in simple rendering mode
    if (!useSimpleRendering) {
      ref.current.position.y += Math.sin(state.clock.elapsedTime * 0.5 * animationSpeed + position[0] * 100) * 0.01 * animationSpeed;
    }
  });
  
  return (
    <mesh
      ref={ref}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <Text
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={isSelected ? 0.02 : 0}
        outlineColor="#ffffff"
      >
        {word.text}
      </Text>
      {isNew && !useSimpleRendering && (
        <mesh>
          <sphereGeometry args={[fontSize * 0.6, useSimpleRendering ? 8 : 16, useSimpleRendering ? 8 : 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
      )}
    </mesh>
  );
};
