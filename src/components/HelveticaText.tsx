import React, { useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface HelveticaTextProps {
  children: string;
  fontSize: number;
  color: string;
  isSelected?: boolean;
  onClick?: () => void;
}

/**
 * Custom text component that uses HTML+CSS to display Helvetica text in a Three.js scene
 */
const HelveticaText: React.FC<HelveticaTextProps> = ({ 
  children, 
  fontSize, 
  color,
  isSelected = false,
  onClick
}) => {
  const ref = useRef<THREE.Group>(null);
  
  // Convert three.js fontSize to CSS px with more dramatic scaling
  const cssSize = fontSize * 2000; // Even more extreme scaling
  
  return (
    <group ref={ref}>
      <Html
        transform
        distanceFactor={10}
        className="drei-html"
        prepend
        center
        style={{
          fontSize: `${cssSize}px`,
          color: color,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 600,
          letterSpacing: '-0.05em',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          pointerEvents: 'auto',
          userSelect: 'none',
          textShadow: isSelected ? '0px 0px 5px white' : 'none',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          textTransform: 'lowercase',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          fontStretch: 'condensed',
          fontKerning: 'normal',
          fontOpticalSizing: 'auto',
          fontFeatureSettings: '"kern" 1',
          textRendering: 'optimizeLegibility',
          display: 'block',
          width: 'auto',
          height: 'auto',
          position: 'relative',
          overflow: 'visible',
        }}
        onClick={e => {
          e.stopPropagation();
          if (onClick) onClick();
        }}
      >
        {children}
      </Html>
    </group>
  );
};

export default HelveticaText; 