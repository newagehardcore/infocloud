import React, { useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface HelveticaTextProps {
  children: string;
  fontSize: number;
  color: string;
  isSelected?: boolean;
}

/**
 * Custom text component that uses HTML+CSS to display Helvetica text in a Three.js scene
 */
export const HelveticaText: React.FC<HelveticaTextProps> = ({ 
  children, 
  fontSize, 
  color,
  isSelected = false
}) => {
  const ref = useRef<THREE.Group>(null);
  
  // Convert three.js fontSize to CSS px
  // Use a more dramatic scaling to match the cube power scaling in TagCloud3D.tsx
  const cssSize = fontSize * 120; // Increased multiplier for more dramatic effect
  
  return (
    <group ref={ref}>
      <Html
        transform
        occlude
        distanceFactor={10}
        style={{
          fontSize: `${cssSize}px`,
          color: color,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 500,
          letterSpacing: '-0.05em',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          pointerEvents: 'none', // Don't block raycasting
          userSelect: 'none', // Prevent text selection
          textShadow: isSelected ? '0px 0px 5px white' : 'none',
          transform: 'translate(-50%, -50%)', // Center the text
        }}
      >
        {children}
      </Html>
    </group>
  );
};

export default HelveticaText; 