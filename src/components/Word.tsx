import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TagCloudWord } from '../types';
import * as THREE from 'three';
// import { getTagFont } from '../utils/fonts';
import HelveticaText from './HelveticaText';

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
  });
  
  return (
    <group
      ref={ref}
      position={position}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <HelveticaText
        fontSize={fontSize}
        color={color}
        isSelected={isSelected}
      >
        {word.text}
      </HelveticaText>
      {isNew && !useSimpleRendering && (
        <mesh>
          <sphereGeometry args={[fontSize * 0.6, useSimpleRendering ? 8 : 16, useSimpleRendering ? 8 : 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  );
};
